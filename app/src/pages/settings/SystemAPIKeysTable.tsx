import React, { startTransition, useCallback, useMemo } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";

import { useNotifySuccess } from "@phoenix/contexts";

import { SystemAPIKeysTableFragment$key } from "./__generated__/SystemAPIKeysTableFragment.graphql";
import { SystemAPIKeysTableQuery } from "./__generated__/SystemAPIKeysTableQuery.graphql";
import { APIKeysTable } from "./APIKeysTable";

export function SystemAPIKeysTable({
  query,
}: {
  query: SystemAPIKeysTableFragment$key;
}) {
  const [data, refetch] = useRefetchableFragment<
    SystemAPIKeysTableQuery,
    SystemAPIKeysTableFragment$key
  >(
    graphql`
      fragment SystemAPIKeysTableFragment on Query
      @refetchable(queryName: "SystemAPIKeysTableQuery") {
        systemApiKeys {
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
    mutation SystemAPIKeysTableDeleteAPIKeyMutation(
      $input: DeleteApiKeyInput!
    ) {
      deleteSystemApiKey(input: $input) {
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
            title: "System key deleted",
            message: "The system key has been deleted and is no longer active.",
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
    return [...data.systemApiKeys];
  }, [data]);

  return <APIKeysTable data={tableData} handleDelete={handleDelete} />;
}
