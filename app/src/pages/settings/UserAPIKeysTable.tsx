import React, { startTransition, useCallback, useMemo } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";

import { useNotifySuccess } from "@phoenix/contexts";

import { UserAPIKeysTableFragment$key } from "./__generated__/UserAPIKeysTableFragment.graphql";
import { UserAPIKeysTableQuery } from "./__generated__/UserAPIKeysTableQuery.graphql";
import { APIKeysTable } from "./APIKeysTable";

export function UserAPIKeysTable({
  query,
}: {
  query: UserAPIKeysTableFragment$key;
}) {
  const [data, refetch] = useRefetchableFragment<
    UserAPIKeysTableQuery,
    UserAPIKeysTableFragment$key
  >(
    graphql`
      fragment UserAPIKeysTableFragment on Query
      @refetchable(queryName: "UserAPIKeysTableQuery") {
        userApiKeys {
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
  const [commit] = useMutation(graphql`
    mutation UserAPIKeysTableDeleteAPIKeyMutation($input: DeleteApiKeyInput!) {
      deleteUserApiKey(input: $input) {
        __typename
        id
      }
    }
  `);
  const handleDelete = useCallback(
    (id: string) => {
      commit({
        variables: {
          input: {
            id,
          },
        },
        onCompleted: () => {
          notifySuccess({
            title: "User key deleted",
            message: "The user key has been deleted and is no longer active.",
          });
          startTransition(() => {
            refetch(
              {},
              {
                fetchPolicy: "network-only",
              }
            );
          });
        },
      });
    },
    [commit, notifySuccess, refetch]
  );

  const tableData = useMemo(() => {
    return [...data.userApiKeys];
  }, [data]);

  return <APIKeysTable data={tableData} handleDelete={handleDelete} />;
}
