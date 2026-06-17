import { css } from "@emotion/react";
import { useCallback, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Card,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { ConfirmButton } from "@phoenix/components/ConfirmButton";
import { Checkbox } from "@phoenix/components/core/checkbox";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { useNotifySuccess } from "@phoenix/contexts";

import type { SettingsRolesPageCreateMutation } from "./__generated__/SettingsRolesPageCreateMutation.graphql";
import type { SettingsRolesPageDeleteMutation } from "./__generated__/SettingsRolesPageDeleteMutation.graphql";
import type { SettingsRolesPagePatchMutation } from "./__generated__/SettingsRolesPagePatchMutation.graphql";
import type { SettingsRolesPageQuery } from "./__generated__/SettingsRolesPageQuery.graphql";

type ObjectPermission = "VIEW" | "EDIT" | "MANAGE_ACCESS";

const ALL_PERMISSIONS: { value: ObjectPermission; label: string }[] = [
  { value: "VIEW", label: "View" },
  { value: "EDIT", label: "Edit" },
  { value: "MANAGE_ACCESS", label: "Manage access" },
];

const PERMISSION_LABELS = new Map(
  ALL_PERMISSIONS.map(({ value, label }) => [value, label])
);

const roleNameFieldCSS = css`
  flex: 1;
`;

function formatPermissions(permissions: readonly string[]) {
  const held = new Set(permissions);
  const ordered = ALL_PERMISSIONS.filter(({ value }) => held.has(value)).map(
    ({ label }) => label
  );
  const unknown = permissions.filter(
    (permission) => !PERMISSION_LABELS.has(permission as ObjectPermission)
  );
  return [...ordered, ...unknown].join(", ");
}

export function SettingsRolesPage() {
  const [fetchKey, setFetchKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Set<ObjectPermission>>(
    new Set(["VIEW"])
  );
  const notifySuccess = useNotifySuccess();

  const data = useLazyLoadQuery<SettingsRolesPageQuery>(
    graphql`
      query SettingsRolesPageQuery {
        permissionSets {
          id
          name
          isBuiltIn
          permissions
        }
      }
    `,
    {},
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const [commitCreate, isCreating] =
    useMutation<SettingsRolesPageCreateMutation>(graphql`
      mutation SettingsRolesPageCreateMutation(
        $input: CreatePermissionSetInput!
      ) {
        createPermissionSet(input: $input) {
          __typename
        }
      }
    `);

  const [commitPatch, isPatching] =
    useMutation<SettingsRolesPagePatchMutation>(graphql`
      mutation SettingsRolesPagePatchMutation(
        $input: PatchPermissionSetInput!
      ) {
        patchPermissionSet(input: $input) {
          __typename
        }
      }
    `);

  const [commitDelete, isDeleting] =
    useMutation<SettingsRolesPageDeleteMutation>(graphql`
      mutation SettingsRolesPageDeleteMutation(
        $input: DeletePermissionSetInput!
      ) {
        deletePermissionSet(input: $input) {
          __typename
        }
      }
    `);

  const isMutating = isCreating || isPatching || isDeleting;
  const refresh = useCallback(() => setFetchKey((k) => k + 1), []);

  const reset = useCallback(() => {
    setEditingId(null);
    setName("");
    setPermissions(new Set(["VIEW"]));
  }, []);

  const togglePermission = useCallback(
    (permission: ObjectPermission, selected: boolean) => {
      setPermissions((prev) => {
        const next = new Set(prev);
        if (selected) {
          next.add(permission);
        } else {
          next.delete(permission);
        }
        return next;
      });
    },
    []
  );

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Permission set name cannot be empty.");
      return;
    }
    if (permissions.size === 0) {
      setError("A permission set must have at least one permission.");
      return;
    }
    setError(null);
    const onCompleted = () => {
      notifySuccess({
        title:
          editingId == null
            ? "Permission set created"
            : "Permission set updated",
        message: `"${trimmed}" saved.`,
      });
      reset();
      refresh();
    };
    const onError = (e: Error) => setError(e.message);
    const perms = Array.from(permissions);
    if (editingId == null) {
      commitCreate({
        variables: { input: { name: trimmed, permissions: perms } },
        onCompleted,
        onError,
      });
    } else {
      commitPatch({
        variables: {
          input: { id: editingId, name: trimmed, permissions: perms },
        },
        onCompleted,
        onError,
      });
    }
  }, [
    commitCreate,
    commitPatch,
    editingId,
    name,
    notifySuccess,
    permissions,
    refresh,
    reset,
  ]);

  const handleEdit = useCallback(
    (role: SettingsRolesPageQuery["response"]["permissionSets"][number]) => {
      setEditingId(role.id);
      setName(role.name);
      setPermissions(new Set(role.permissions as ObjectPermission[]));
      setError(null);
    },
    []
  );

  const handleDelete = useCallback(
    (id: string, roleName: string) => {
      setError(null);
      commitDelete({
        variables: { input: { id } },
        onCompleted: () => {
          notifySuccess({
            title: "Permission set deleted",
            message: `"${roleName}" removed. Grants using it fall back to view.`,
          });
          if (editingId === id) reset();
          refresh();
        },
        onError: (e) => setError(e.message),
      });
    },
    [commitDelete, editingId, notifySuccess, refresh, reset]
  );

  return (
    <Flex direction="column" gap="size-200" width="100%">
      {error && <Alert variant="danger">{error}</Alert>}
      <Card
        title={
          editingId == null ? "Create permission set" : "Edit permission set"
        }
        subTitle="Reusable permission sets for project, dataset, and prompt grants."
        titleSeparator={false}
      >
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <Flex direction="row" gap="size-100" alignItems="end">
              <TextField value={name} onChange={setName} css={roleNameFieldCSS}>
                <Label>Name</Label>
                <Input placeholder="e.g. Annotator" />
              </TextField>
              {editingId != null && (
                <Button size="S" onPress={reset}>
                  Cancel
                </Button>
              )}
              <Button
                size="S"
                variant="primary"
                isDisabled={
                  !name.trim() || permissions.size === 0 || isMutating
                }
                leadingVisual={<Icon svg={<Icons.PlusCircle />} />}
                onPress={handleSave}
              >
                {editingId == null ? "Create" : "Save"}
              </Button>
            </Flex>
            <Flex direction="row" gap="size-200">
              {ALL_PERMISSIONS.map((p) => (
                <Checkbox
                  key={p.value}
                  isSelected={permissions.has(p.value)}
                  onChange={(selected) => togglePermission(p.value, selected)}
                >
                  {p.label}
                </Checkbox>
              ))}
            </Flex>
          </Flex>
        </View>
      </Card>
      <Card
        title="Permission sets"
        subTitle="Built-in permission sets are read-only. Custom permission sets can be edited or deleted."
        titleSeparator={false}
      >
        <table css={tableCSS}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Permissions</th>
              <th>Type</th>
              <th />
            </tr>
          </thead>
          {data.permissionSets.length === 0 ? (
            <TableEmpty message="No permission sets" />
          ) : (
            <tbody>
              {data.permissionSets.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{formatPermissions(role.permissions)}</td>
                  <td>
                    <Text color={role.isBuiltIn ? "gray-500" : undefined}>
                      {role.isBuiltIn ? "Built-in" : "Custom"}
                    </Text>
                  </td>
                  <td>
                    <Flex justifyContent="end" gap="size-100">
                      {!role.isBuiltIn && (
                        <>
                          <Button
                            size="S"
                            isDisabled={isMutating}
                            leadingVisual={<Icon svg={<Icons.Edit2 />} />}
                            onPress={() => handleEdit(role)}
                          >
                            Edit
                          </Button>
                          <ConfirmButton
                            buttonText="Delete"
                            buttonAriaLabel={`Delete permission set ${role.name}`}
                            isDisabled={isMutating}
                            title="Delete permission set"
                            message={
                              <>
                                Delete the permission set{" "}
                                <strong>{role.name}</strong>? Existing grants
                                that use it will fall back to view-only access.
                              </>
                            }
                            confirmText="Delete permission set"
                            onConfirm={() => handleDelete(role.id, role.name)}
                          />
                        </>
                      )}
                    </Flex>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </Card>
    </Flex>
  );
}
