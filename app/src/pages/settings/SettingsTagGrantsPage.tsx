import { css } from "@emotion/react";
import { useDeferredValue, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Card,
  ComboBox,
  ComboBoxItem,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  TextField,
  Token,
  View,
} from "@phoenix/components";
import { ConfirmButton } from "@phoenix/components/ConfirmButton";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { useNotifySuccess } from "@phoenix/contexts";
import {
  buildSubjectItems,
  resolveSelectedSubject,
  subjectInputFromParts,
} from "@phoenix/pages/access/ResourceAccessForm";

import type { SettingsTagGrantsPageGrantMutation } from "./__generated__/SettingsTagGrantsPageGrantMutation.graphql";
import type { SettingsTagGrantsPageQuery } from "./__generated__/SettingsTagGrantsPageQuery.graphql";
import type { SettingsTagGrantsPageRevokeMutation } from "./__generated__/SettingsTagGrantsPageRevokeMutation.graphql";

type ObjectType = "PROJECT" | "DATASET" | "PROMPT";

const OBJECT_TYPES: { value: ObjectType; label: string }[] = [
  { value: "PROJECT", label: "Projects" },
  { value: "DATASET", label: "Datasets" },
  { value: "PROMPT", label: "Prompts" },
];

const OBJECT_TYPE_NOUN: Record<ObjectType, string> = {
  PROJECT: "project",
  DATASET: "dataset",
  PROMPT: "prompt",
};

const addGrantRowCSS = css`
  display: grid;
  grid-template-columns:
    minmax(200px, 1.4fr) minmax(120px, 0.8fr) minmax(120px, 1fr)
    minmax(120px, 1fr) minmax(140px, 1fr) auto;
  gap: var(--global-dimension-size-200);
  align-items: end;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
`;

const tagTokenCSS = css`
  font-variant-numeric: tabular-nums;
  .tag-key {
    font-weight: 600;
  }
  .tag-sep {
    margin: 0 var(--global-dimension-size-75);
    opacity: 0.5;
  }
`;

/**
 * Type-scoped access by tag. A tag grant gives a person or group a permission set over every project,
 * dataset, or prompt that carries a `key=value` tag (set from that object's Access page). Unlike
 * a per-object grant it is anchored to no single object, so authoring one is an administrator
 * action. A tag grant confers view or edit only — never manage-access — so a tag's mutable reach
 * can never be someone's sole path to managing an object.
 */
export function SettingsTagGrantsPage() {
  const [fetchKey, setFetchKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [objectType, setObjectType] = useState<ObjectType>("PROJECT");
  const [tagKey, setTagKey] = useState("");
  const [tagValue, setTagValue] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [subjectSearch, setSubjectSearch] = useState("");
  const deferredSubjectSearch = useDeferredValue(subjectSearch.trim());
  const notifySuccess = useNotifySuccess();

  const data = useLazyLoadQuery<SettingsTagGrantsPageQuery>(
    graphql`
      query SettingsTagGrantsPageQuery($userFilter: UserFilter) {
        tagGrants {
          id
          subjectKind
          subjectId
          subjectName
          objectType
          tagKey
          tagValue
          roleName
        }
        users(first: 25, filter: $userFilter) {
          edges {
            user: node {
              id
              username
              email
            }
          }
        }
        userGroups {
          id
          name
        }
        permissionSets {
          id
          name
          permissions
        }
      }
    `,
    {
      userFilter: deferredSubjectSearch
        ? { value: deferredSubjectSearch }
        : null,
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const [commitGrant, isGranting] =
    useMutation<SettingsTagGrantsPageGrantMutation>(graphql`
      mutation SettingsTagGrantsPageGrantMutation(
        $input: TagAccessGrantInput!
      ) {
        grantTagAccess(input: $input) {
          __typename
        }
      }
    `);

  const [commitRevoke, isRevoking] =
    useMutation<SettingsTagGrantsPageRevokeMutation>(graphql`
      mutation SettingsTagGrantsPageRevokeMutation(
        $input: TagAccessGrantInput!
      ) {
        revokeTagAccess(input: $input) {
          __typename
        }
      }
    `);

  const isMutating = isGranting || isRevoking;

  // A tag grant may confer view or edit only — never manage-access — so the picker hides
  // manage-conferring permission sets (the server rejects them too).
  const grantableRoles = data.permissionSets.filter(
    (role) => !role.permissions.includes("MANAGE_ACCESS")
  );

  const subjectItems = buildSubjectItems(
    data.users.edges.map((edge) => edge.user),
    data.userGroups
  );

  const refresh = () => setFetchKey((k) => k + 1);

  const grant = () => {
    if (!selectedSubject) return;
    const subject = resolveSelectedSubject(selectedSubject);
    if (subject == null) {
      setError("Could not resolve the selected subject.");
      return;
    }
    const key = tagKey.trim();
    const value = tagValue.trim();
    if (!key || !value) {
      setError("A tag grant needs both a key and a value.");
      return;
    }
    setError(null);
    commitGrant({
      variables: {
        input: {
          subject,
          objectType,
          tagKey: key,
          tagValue: value,
          permissionSetId: selectedRoleId || null,
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Tag grant created",
          message: `Granted access to ${OBJECT_TYPE_NOUN[objectType]}s tagged ${key} = ${value}.`,
        });
        setSelectedSubject(null);
        setTagKey("");
        setTagValue("");
        setSelectedRoleId(null);
        refresh();
      },
      onError: (e) => setError(e.message),
    });
  };

  const revoke = (
    grantRow: SettingsTagGrantsPageQuery["response"]["tagGrants"][number]
  ) => {
    setError(null);
    commitRevoke({
      variables: {
        input: {
          subject: subjectInputFromParts(
            grantRow.subjectKind,
            grantRow.subjectId ?? null
          ),
          objectType: grantRow.objectType,
          tagKey: grantRow.tagKey,
          tagValue: grantRow.tagValue,
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Tag grant revoked",
          message: "The tag grant has been removed.",
        });
        refresh();
      },
      onError: (e) => setError(e.message),
    });
  };

  return (
    <Flex direction="column" gap="size-200" width="100%">
      {error && <Alert variant="danger">{error}</Alert>}
      <Card
        title="Grant access by tag"
        subTitle="Give a person or group a permission set over every project, dataset, or prompt carrying a tag. Set tags from each object's Access page."
        titleSeparator={false}
      >
        <View padding="size-200">
          <div css={addGrantRowCSS}>
            <ComboBox
              label="Person or group"
              placeholder="Search people and groups…"
              width="100%"
              selectedKey={selectedSubject}
              onSelectionChange={(key) =>
                setSelectedSubject(key == null ? null : String(key))
              }
              onInputChange={setSubjectSearch}
              renderEmptyState={() => "No people or groups found"}
            >
              {subjectItems.map((item) => (
                <ComboBoxItem key={item.id} id={item.id} textValue={item.label}>
                  {item.label}
                </ComboBoxItem>
              ))}
            </ComboBox>
            <Select
              value={objectType}
              onChange={(key) =>
                key != null && setObjectType(key as ObjectType)
              }
            >
              <Label>Applies to</Label>
              <Button>
                <SelectValue />
                <SelectChevronUpDownIcon />
              </Button>
              <Popover>
                <ListBox>
                  {OBJECT_TYPES.map((option) => (
                    <SelectItem key={option.value} id={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </ListBox>
              </Popover>
            </Select>
            <TextField value={tagKey} onChange={setTagKey}>
              <Label>Tag key</Label>
              <Input placeholder="e.g. env" />
            </TextField>
            <TextField value={tagValue} onChange={setTagValue}>
              <Label>Tag value</Label>
              <Input placeholder="e.g. prod" />
            </TextField>
            <Select
              value={selectedRoleId ?? undefined}
              onChange={(key) =>
                setSelectedRoleId(key == null ? null : String(key))
              }
              placeholder="Viewer"
            >
              <Label>Permission set</Label>
              <Button>
                <SelectValue />
                <SelectChevronUpDownIcon />
              </Button>
              <Popover>
                <ListBox>
                  {grantableRoles.map((role) => (
                    <SelectItem key={role.id} id={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </ListBox>
              </Popover>
            </Select>
            <Button
              size="S"
              variant="primary"
              isDisabled={
                !selectedSubject ||
                !tagKey.trim() ||
                !tagValue.trim() ||
                isMutating
              }
              leadingVisual={<Icon svg={<Icons.PlusCircle />} />}
              onPress={grant}
            >
              Grant
            </Button>
          </div>
        </View>
      </Card>
      <Card
        title="Tag grants"
        subTitle="Access rules that follow tags. A grant applies to any matching object, including ones tagged later."
        titleSeparator={false}
      >
        <table css={tableCSS}>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Applies to</th>
              <th>Tag</th>
              <th>Permission set</th>
              <th />
            </tr>
          </thead>
          {data.tagGrants.length === 0 ? (
            <TableEmpty message="No tag grants yet" />
          ) : (
            <tbody>
              {data.tagGrants.map((grantRow) => (
                <tr key={grantRow.id}>
                  <td>
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <Icon
                        svg={
                          grantRow.subjectKind === "EVERYONE" ? (
                            <Icons.Globe />
                          ) : (
                            <Icons.Person />
                          )
                        }
                      />
                      {grantRow.subjectName}
                    </Flex>
                  </td>
                  <td>
                    {OBJECT_TYPE_NOUN[grantRow.objectType as ObjectType]}s
                  </td>
                  <td>
                    <Token
                      size="M"
                      color="var(--global-color-blue-700)"
                      css={tagTokenCSS}
                    >
                      <span className="tag-key">{grantRow.tagKey}</span>
                      <span className="tag-sep">=</span>
                      {grantRow.tagValue}
                    </Token>
                  </td>
                  <td>{grantRow.roleName ?? "Viewer"}</td>
                  <td>
                    <Flex justifyContent="end">
                      <ConfirmButton
                        buttonText="Revoke"
                        buttonAriaLabel={`Revoke tag grant for ${grantRow.subjectName}`}
                        title="Revoke tag grant"
                        message={
                          <>
                            Revoke <strong>{grantRow.subjectName}</strong>
                            &apos;s access to{" "}
                            {
                              OBJECT_TYPE_NOUN[
                                grantRow.objectType as ObjectType
                              ]
                            }
                            s tagged{" "}
                            <strong>
                              {grantRow.tagKey} = {grantRow.tagValue}
                            </strong>
                            ?
                          </>
                        }
                        confirmText="Revoke"
                        isDisabled={isMutating}
                        onConfirm={() => revoke(grantRow)}
                      />
                    </Flex>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        <View paddingX="size-200" paddingBottom="size-200">
          <Text size="XS" color="text-700">
            Tag grants confer view or edit only — never manage-access.
          </Text>
        </View>
      </Card>
    </Flex>
  );
}
