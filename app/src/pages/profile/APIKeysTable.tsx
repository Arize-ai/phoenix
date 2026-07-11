import { startTransition } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";

import { APIKeysList } from "@phoenix/components/auth";
import { useNotifySuccess } from "@phoenix/contexts";

import type { APIKeysTableFragment$key } from "./__generated__/APIKeysTableFragment.graphql";
import type { APIKeysTableQuery } from "./__generated__/APIKeysTableQuery.graphql";

export function APIKeysTable({ query }: { query: APIKeysTableFragment$key }) {
  const [data, refetch] = useRefetchableFragment<
    APIKeysTableQuery,
    APIKeysTableFragment$key
  >(
    graphql`
      fragment APIKeysTableFragment on User
      @refetchable(queryName: "APIKeysTableQuery") {
        apiKeys {
          id
          name
          description
          createdAt
          expiresAt
        }
      }
    `,
    query
  );

  const notifySuccess = useNotifySuccess();
  const [commit, isCommitting] = useMutation(graphql`
    mutation APIKeysTableDeleteAPIKeyMutation($input: DeleteApiKeyInput!) {
      deleteUserApiKey(input: $input) {
        query {
          viewer {
            ...APIKeysTableFragment
          }
        }
      }
    }
  `);
  const handleDelete = (id: string) => {
    commit({
      variables: {
        input: {
          id,
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "API key deleted",
          message: "The key has been deleted and is no longer active.",
        });
        startTransition(() => {
          refetch(
            {},
            {
              fetchPolicy: "store-and-network",
            }
          );
        });
      },
    });
  };

  return (
    <APIKeysList
      apiKeys={data.apiKeys.filter(Boolean)}
      emptyDescription="You have not created any API keys."
      isDeleting={isCommitting}
      onDelete={handleDelete}
    />
  );
}
