import { css } from "@emotion/react";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Card,
  ComboBox,
  ComboBoxItem,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Input,
  Loading,
  Modal,
  ModalOverlay,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { ConfirmButton } from "@phoenix/components/ConfirmButton";
import { tableCSS } from "@phoenix/components/table/styles";
import { useNotifySuccess } from "@phoenix/contexts";
import { parseGlobalId } from "@phoenix/utils/globalIdUtils";

import type { SettingsGroupsPageAddMemberMutation } from "./__generated__/SettingsGroupsPageAddMemberMutation.graphql";
import type { SettingsGroupsPageCreateMutation } from "./__generated__/SettingsGroupsPageCreateMutation.graphql";
import type { SettingsGroupsPageDeleteMutation } from "./__generated__/SettingsGroupsPageDeleteMutation.graphql";
import type { SettingsGroupsPageQuery } from "./__generated__/SettingsGroupsPageQuery.graphql";
import type { SettingsGroupsPageRemoveMemberMutation } from "./__generated__/SettingsGroupsPageRemoveMemberMutation.graphql";

const cardToolbarCSS = css`
  display: flex;
  justify-content: flex-end;
  padding: var(--global-dimension-size-200);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);
`;

const groupNameFieldCSS = css`
  width: 260px;
`;

export function SettingsGroupsPage() {
  const [fetchKey, setFetchKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [memberToAdd, setMemberToAdd] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const deferredMemberSearch = useDeferredValue(memberSearch.trim());
  const notifySuccess = useNotifySuccess();

  const data = useLazyLoadQuery<SettingsGroupsPageQuery>(
    graphql`
      query SettingsGroupsPageQuery($userFilter: UserFilter) {
        userGroups {
          groupId
          name
          provider
          isLocal
          memberUserIds
        }
        users(first: 1000) {
          edges {
            user: node {
              id
              username
              email
            }
          }
        }
        memberCandidates: users(first: 25, filter: $userFilter) {
          edges {
            user: node {
              id
              username
              email
            }
          }
        }
      }
    `,
    {
      userFilter: deferredMemberSearch ? { value: deferredMemberSearch } : null,
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const [commitCreate, isCreating] =
    useMutation<SettingsGroupsPageCreateMutation>(graphql`
      mutation SettingsGroupsPageCreateMutation($name: String!) {
        createUserGroup(name: $name) {
          __typename
        }
      }
    `);
  const [commitDelete, isDeleting] =
    useMutation<SettingsGroupsPageDeleteMutation>(graphql`
      mutation SettingsGroupsPageDeleteMutation($groupId: Int!) {
        deleteUserGroup(groupId: $groupId) {
          __typename
        }
      }
    `);
  const [commitAdd, isAdding] =
    useMutation<SettingsGroupsPageAddMemberMutation>(graphql`
      mutation SettingsGroupsPageAddMemberMutation(
        $groupId: Int!
        $userId: Int!
      ) {
        addUserGroupMember(groupId: $groupId, userId: $userId) {
          __typename
        }
      }
    `);
  const [commitRemove, isRemoving] =
    useMutation<SettingsGroupsPageRemoveMemberMutation>(graphql`
      mutation SettingsGroupsPageRemoveMemberMutation(
        $groupId: Int!
        $userId: Int!
      ) {
        removeUserGroupMember(groupId: $groupId, userId: $userId) {
          __typename
        }
      }
    `);

  const refresh = useCallback(() => setFetchKey((k) => k + 1), []);
  const closeGroupDialog = useCallback(() => {
    setSelectedGroupId(null);
    setMemberToAdd(null);
    setMemberToRemove(null);
    setMemberSearch("");
  }, []);
  const isMutating = isCreating || isDeleting || isAdding || isRemoving;

  const groups = data.userGroups;
  const usersByNumericId = useMemo(() => {
    const m = new Map<number, string>();
    for (const { user } of data.users.edges) {
      const parsed = parseGlobalId(user.id);
      if (!parsed) continue;
      m.set(
        Number(parsed.nodeId),
        user.email || user.username || `user ${parsed.nodeId}`
      );
    }
    return m;
  }, [data.users.edges]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.groupId === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const addableUsers = useMemo(() => {
    if (!selectedGroup) return [] as { id: string; label: string }[];
    const members = new Set(selectedGroup.memberUserIds);
    const items: { id: string; label: string }[] = [];
    for (const { user } of data.memberCandidates.edges) {
      const parsed = parseGlobalId(user.id);
      if (!parsed) continue;
      const numId = Number(parsed.nodeId);
      const label = user.email || user.username || `user ${parsed.nodeId}`;
      if (!members.has(numId)) items.push({ id: String(numId), label });
    }
    return items;
  }, [data.memberCandidates.edges, selectedGroup]);

  const handleCreate = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    commitCreate({
      variables: { name },
      onCompleted: () => {
        notifySuccess({ title: "Group created", message: `Created ${name}.` });
        setNewName("");
        refresh();
      },
      onError: (e) => setError(e.message),
    });
  }, [commitCreate, newName, notifySuccess, refresh]);

  const handleDelete = useCallback(
    (groupId: number) => {
      setError(null);
      commitDelete({
        variables: { groupId },
        onCompleted: () => {
          notifySuccess({
            title: "Group deleted",
            message: "The group and its grants were removed.",
          });
          if (selectedGroupId === groupId) closeGroupDialog();
          refresh();
        },
        onError: (e) => setError(e.message),
      });
    },
    [closeGroupDialog, commitDelete, notifySuccess, refresh, selectedGroupId]
  );

  const handleAddMember = useCallback(() => {
    if (!selectedGroup || !memberToAdd) return;
    setError(null);
    commitAdd({
      variables: {
        groupId: selectedGroup.groupId,
        userId: Number(memberToAdd),
      },
      onCompleted: () => {
        notifySuccess({ title: "Member added", message: "Member added." });
        setMemberToAdd(null);
        setMemberSearch("");
        refresh();
      },
      onError: (e) => setError(e.message),
    });
  }, [commitAdd, memberToAdd, notifySuccess, refresh, selectedGroup]);

  const handleRemoveMember = useCallback(
    (userId: number) => {
      if (!selectedGroup) return;
      setError(null);
      commitRemove({
        variables: { groupId: selectedGroup.groupId, userId },
        onCompleted: () => {
          notifySuccess({
            title: "Member removed",
            message: "Member removed.",
          });
          setMemberToRemove(null);
          refresh();
        },
        onError: (e) => setError(e.message),
      });
    },
    [commitRemove, notifySuccess, refresh, selectedGroup]
  );

  return (
    <Flex direction="column" gap="size-200" width="100%">
      {error && <Alert variant="danger">{error}</Alert>}
      <Card title="User groups" titleSeparator={false}>
        <div css={cardToolbarCSS}>
          <Flex direction="row" gap="size-100" alignItems="end">
            <TextField
              value={newName}
              onChange={setNewName}
              aria-label="New group name"
              css={groupNameFieldCSS}
            >
              <Input placeholder="New group name" />
            </TextField>
            <Button
              size="S"
              variant="primary"
              isDisabled={!newName.trim() || isMutating}
              leadingVisual={<Icon svg={<Icons.PlusCircle />} />}
              onPress={handleCreate}
            >
              Create
            </Button>
          </Flex>
        </div>
        <table css={tableCSS}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Source</th>
              <th>Members</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <View padding="size-200">
                    <Text color="text-700">
                      No groups yet. Create a local group to grant access to a
                      team at once.
                    </Text>
                  </View>
                </td>
              </tr>
            ) : (
              groups.map((group) => (
                <tr key={group.groupId}>
                  <td>{group.name}</td>
                  <td>{group.isLocal ? "Local" : group.provider}</td>
                  <td>{group.memberUserIds.length}</td>
                  <td>
                    <Flex justifyContent="end" gap="size-100">
                      <Button
                        size="S"
                        onPress={() => {
                          setSelectedGroupId(group.groupId);
                          setMemberToAdd(null);
                          setMemberToRemove(null);
                          setMemberSearch("");
                        }}
                      >
                        {group.isLocal ? "Manage" : "View"}
                      </Button>
                      {group.isLocal && (
                        <ConfirmButton
                          buttonText="Delete"
                          buttonAriaLabel={`Delete group ${group.name}`}
                          isDisabled={isMutating}
                          title="Delete group"
                          message={
                            <>
                              Delete the group <strong>{group.name}</strong>?
                              This removes the group and revokes every access
                              grant made to it.
                            </>
                          }
                          confirmText="Delete group"
                          onConfirm={() => handleDelete(group.groupId)}
                        />
                      )}
                    </Flex>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <DialogTrigger
        isOpen={selectedGroup != null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closeGroupDialog();
          }
        }}
      >
        <ModalOverlay>
          <Modal size="L">
            {selectedGroup && (
              <Dialog>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {selectedGroup.isLocal ? "Manage" : "View"}{" "}
                      {selectedGroup.name}
                    </DialogTitle>
                    <DialogTitleExtra>
                      <DialogCloseButton onPress={closeGroupDialog} />
                    </DialogTitleExtra>
                  </DialogHeader>
                  {selectedGroup.isLocal && (
                    <div css={cardToolbarCSS}>
                      <Flex direction="row" gap="size-100" alignItems="end">
                        <ComboBox
                          label="Add member"
                          placeholder="Search people…"
                          width="320px"
                          selectedKey={memberToAdd}
                          onSelectionChange={(key) =>
                            setMemberToAdd(key == null ? null : String(key))
                          }
                          onInputChange={setMemberSearch}
                          renderEmptyState={() => "No people available"}
                        >
                          {addableUsers.map((item) => (
                            <ComboBoxItem
                              key={item.id}
                              id={item.id}
                              textValue={item.label}
                            >
                              {item.label}
                            </ComboBoxItem>
                          ))}
                        </ComboBox>
                        <Button
                          size="S"
                          variant="primary"
                          isDisabled={!memberToAdd || isMutating}
                          onPress={handleAddMember}
                        >
                          Add
                        </Button>
                      </Flex>
                    </div>
                  )}
                  {!selectedGroup.isLocal && (
                    <View padding="size-200">
                      <Text color="text-700">
                        This group is synced from {selectedGroup.provider}. Its
                        membership is managed by the identity provider and is
                        read-only here.
                      </Text>
                    </View>
                  )}
                  <table css={tableCSS}>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGroup.memberUserIds.length === 0 ? (
                        <tr>
                          <td colSpan={2}>
                            <View padding="size-200">
                              <Text color="text-700">No members.</Text>
                            </View>
                          </td>
                        </tr>
                      ) : (
                        selectedGroup.memberUserIds.map((userId) => {
                          const memberLabel =
                            usersByNumericId.get(userId) ?? `user ${userId}`;
                          return (
                            <tr key={userId}>
                              <td>{memberLabel}</td>
                              <td>
                                <Flex justifyContent="end" gap="size-100">
                                  {selectedGroup.isLocal &&
                                    (memberToRemove === userId ? (
                                      <>
                                        <Button
                                          size="S"
                                          onPress={() =>
                                            setMemberToRemove(null)
                                          }
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="S"
                                          variant="danger"
                                          isDisabled={isMutating}
                                          onPress={() =>
                                            handleRemoveMember(userId)
                                          }
                                        >
                                          Remove member
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        size="S"
                                        variant="danger"
                                        isDisabled={isMutating}
                                        leadingVisual={
                                          <Icon svg={<Icons.Trash />} />
                                        }
                                        aria-label={`Remove ${memberLabel} from ${selectedGroup.name}`}
                                        onPress={() =>
                                          setMemberToRemove(userId)
                                        }
                                      >
                                        Remove
                                      </Button>
                                    ))}
                                </Flex>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </DialogContent>
              </Dialog>
            )}
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
      {isMutating && <Loading />}
    </Flex>
  );
}
