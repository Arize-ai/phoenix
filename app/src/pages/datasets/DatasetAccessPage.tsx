import { useDeferredValue, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  buildSubjectItems,
  ResourceAccessForm,
} from "@phoenix/pages/access/ResourceAccessForm";

import type { DatasetAccessPageQuery } from "./__generated__/DatasetAccessPageQuery.graphql";

export function DatasetAccessPageContent({ datasetId }: { datasetId: string }) {
  const [fetchKey, setFetchKey] = useState(0);
  const [subjectSearch, setSubjectSearch] = useState("");
  const deferredSubjectSearch = useDeferredValue(subjectSearch.trim());

  const data = useLazyLoadQuery<DatasetAccessPageQuery>(
    graphql`
      query DatasetAccessPageQuery($datasetId: ID!, $userFilter: UserFilter) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            id
            accessGrants {
              subjectKind
              subjectId
              subjectName
              roleId
              roleName
            }
          }
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
        resourceTags(objectType: DATASET, objectId: $datasetId) {
          key
          value
        }
      }
    `,
    {
      datasetId,
      userFilter: deferredSubjectSearch
        ? { value: deferredSubjectSearch }
        : null,
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  return (
    <ResourceAccessForm
      object={{ datasetId }}
      grants={data.dataset?.accessGrants ?? []}
      tags={data.resourceTags}
      permissionSets={data.permissionSets}
      subjectItems={buildSubjectItems(
        data.users.edges.map((edge) => edge.user),
        data.userGroups
      )}
      onSubjectSearchChange={setSubjectSearch}
      onRefresh={() => setFetchKey((key) => key + 1)}
      isModal
    />
  );
}
