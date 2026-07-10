import { css } from "@emotion/react";
import { startTransition, useState } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";

import {
  Alert,
  Card,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { DeleteAPIKeyButton } from "@phoenix/components/auth";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { useNotifySuccess } from "@phoenix/contexts";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import type { UserAPIKeysCardDeleteAPIKeyMutation } from "@phoenix/pages/settings/__generated__/UserAPIKeysCardDeleteAPIKeyMutation.graphql";
import type { UserAPIKeysCardFragment$key } from "@phoenix/pages/settings/__generated__/UserAPIKeysCardFragment.graphql";
import type { UserAPIKeysCardQuery } from "@phoenix/pages/settings/__generated__/UserAPIKeysCardQuery.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

const apiKeysListCSS = css`
  list-style: none;
  margin: 0;
  padding: var(--global-dimension-size-200);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const apiKeyCSS = css`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

const apiKeyIconCSS = css`
  flex: none;
  width: var(--global-dimension-size-450);
  height: var(--global-dimension-size-450);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--global-color-gray-100);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  color: var(--global-text-color-700);
`;

const apiKeyMetadataCSS = css`
  list-style: none;
  margin: var(--global-dimension-size-100) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-100);
`;

const metadataLabelCSS = css`
  display: block;
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-xs);
`;

export function UserAPIKeysCard({
  user,
  userName,
}: {
  user: UserAPIKeysCardFragment$key;
  userName: string;
}) {
  const [data, refetch] = useRefetchableFragment<
    UserAPIKeysCardQuery,
    UserAPIKeysCardFragment$key
  >(
    graphql`
      fragment UserAPIKeysCardFragment on User
      @refetchable(queryName: "UserAPIKeysCardQuery") {
        id
        apiKeys {
          id
          name
          description
          createdAt
          expiresAt
        }
      }
    `,
    user
  );
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const { fullTimeFormatter } = useTimeFormatters();
  const [commit, isCommitting] =
    useMutation<UserAPIKeysCardDeleteAPIKeyMutation>(graphql`
      mutation UserAPIKeysCardDeleteAPIKeyMutation(
        $input: DeleteApiKeyInput!
        $userId: ID!
      ) {
        deleteUserApiKey(input: $input) {
          apiKeyId
          query {
            node(id: $userId) {
              ... on User {
                apiKeyCount
              }
            }
          }
        }
      }
    `);

  const deleteAPIKey = ({ id }: { id: string }) => {
    setError(null);
    commit({
      variables: { input: { id }, userId: data.id },
      onCompleted: () => {
        notifySuccess({
          title: "API key deleted",
          message: "The key has been deleted and is no longer active.",
        });
        startTransition(() => {
          refetch({}, { fetchPolicy: "network-only" });
        });
      },
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        setError(formattedError?.[0] ?? error.message);
      },
    });
  };

  return (
    <Card title="API Keys">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {data.apiKeys.length === 0 ? (
        <View padding="size-500">
          <EmptyState
            graphic={<EmptyStateGraphic variant="credential" />}
            title="No API keys"
            description={`${userName} has not created any API keys.`}
          />
        </View>
      ) : (
        <ul css={apiKeysListCSS}>
          {data.apiKeys.map((apiKey) => (
            <li key={apiKey.id} css={apiKeyCSS}>
              <div css={apiKeyIconCSS} aria-hidden="true">
                <Icon svg={<Icons.Key />} />
              </div>
              <div>
                <Flex direction="column" gap="size-50">
                  <Text weight="heavy">{apiKey.name}</Text>
                  {apiKey.description ? (
                    <Text size="S" color="text-700">
                      {apiKey.description}
                    </Text>
                  ) : null}
                </Flex>
                <ul css={apiKeyMetadataCSS}>
                  <li>
                    <span css={metadataLabelCSS}>Created</span>
                    <Text size="XS">
                      {fullTimeFormatter(new Date(apiKey.createdAt))}
                    </Text>
                  </li>
                  <li>
                    <span css={metadataLabelCSS}>Expires</span>
                    <Text size="XS">
                      {apiKey.expiresAt
                        ? fullTimeFormatter(new Date(apiKey.expiresAt))
                        : "Never"}
                    </Text>
                  </li>
                </ul>
              </div>
              <DeleteAPIKeyButton
                apiKeyName={apiKey.name}
                isDisabled={isCommitting}
                handleDelete={() => deleteAPIKey({ id: apiKey.id })}
                trigger="menu"
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
