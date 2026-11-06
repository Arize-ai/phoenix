import { startTransition, useState } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";

import { Alert, Card } from "@phoenix/components";
import { APIKeysList } from "@phoenix/components/auth";
import { useNotifySuccess } from "@phoenix/contexts";
import type { UserAPIKeysCardDeleteAPIKeyMutation } from "@phoenix/pages/settings/__generated__/UserAPIKeysCardDeleteAPIKeyMutation.graphql";
import type { UserAPIKeysCardFragment$key } from "@phoenix/pages/settings/__generated__/UserAPIKeysCardFragment.graphql";
import type { UserAPIKeysCardQuery } from "@phoenix/pages/settings/__generated__/UserAPIKeysCardQuery.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

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
      <APIKeysList
        apiKeys={data.apiKeys}
        emptyDescription={`${userName} has not created any API keys.`}
        isDeleting={isCommitting}
        onDelete={(id) => deleteAPIKey({ id })}
      />
    </Card>
  );
}
