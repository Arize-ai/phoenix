import { css } from "@emotion/react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Text,
  View,
} from "@phoenix/components";

import type { UserAccessDialogQuery } from "./__generated__/UserAccessDialogQuery.graphql";

const accessListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
`;

const RESOURCE_KINDS = [
  { kind: "project", label: "Projects" },
  { kind: "dataset", label: "Datasets" },
  { kind: "prompt", label: "Prompts" },
] as const;

export function UserAccessDialog({
  userId,
  userLabel,
  onClose,
}: {
  userId: string;
  userLabel: string;
  onClose: () => void;
}) {
  const data = useLazyLoadQuery<UserAccessDialogQuery>(
    graphql`
      query UserAccessDialogQuery($userId: ID!) {
        node(id: $userId) {
          ... on User {
            accessSummary {
              isAdmin
              allProjects
              allDatasets
              allPrompts
              objects {
                kind
                id
                name
              }
            }
          }
        }
      }
    `,
    { userId }
  );

  const summary = data.node?.accessSummary;
  const allByKind: Record<string, boolean> = {
    project: summary?.allProjects ?? false,
    dataset: summary?.allDatasets ?? false,
    prompt: summary?.allPrompts ?? false,
  };

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Access for {userLabel}</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton onPress={onClose} slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          {!summary ? (
            <Text color="text-700">No access information available.</Text>
          ) : (
            <Flex direction="column" gap="size-200">
              {summary.isAdmin ? (
                <Text>
                  Administrator: can access every project, dataset, and prompt.
                </Text>
              ) : null}
              {RESOURCE_KINDS.map(({ kind, label }) => {
                const items = summary.objects.filter(
                  (object) => object.kind === kind
                );
                return (
                  <Flex key={kind} direction="column" gap="size-50">
                    <Text weight="heavy" size="S">
                      {label}
                    </Text>
                    {allByKind[kind] ? (
                      <Text color="text-700">All {label.toLowerCase()}</Text>
                    ) : items.length === 0 ? (
                      <Text color="text-700">None</Text>
                    ) : (
                      <ul css={accessListCSS}>
                        {items.map((item) => (
                          <li key={item.id}>{item.name}</li>
                        ))}
                      </ul>
                    )}
                  </Flex>
                );
              })}
            </Flex>
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}
