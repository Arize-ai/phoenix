import { startTransition } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";

import { APIKeysList } from "@phoenix/components/auth";
import { useNotifySuccess } from "@phoenix/contexts";

import type { ViewerAPIKeysListFragment$key } from "./__generated__/ViewerAPIKeysListFragment.graphql";
import type { ViewerAPIKeysListQuery } from "./__generated__/ViewerAPIKeysListQuery.graphql";

export function ViewerAPIKeysList({
  query,
}: {
  query: ViewerAPIKeysListFragment$key;
}) {
  const [data, refetch] = useRefetchableFragment<
    ViewerAPIKeysListQuery,
    ViewerAPIKeysListFragment$key
  >(
    graphql`
      fragment ViewerAPIKeysListFragment on User
      @refetchable(queryName: "ViewerAPIKeysListQuery") {
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
    mutation ViewerAPIKeysListDeleteAPIKeyMutation($input: DeleteApiKeyInput!) {
      deleteUserApiKey(input: $input) {
        query {
          viewer {
            ...ViewerAPIKeysListFragment
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
