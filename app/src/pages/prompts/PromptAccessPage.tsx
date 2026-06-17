import { useDeferredValue, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  buildSubjectItems,
  ResourceAccessForm,
} from "@phoenix/pages/access/ResourceAccessForm";

import type { PromptAccessPageQuery } from "./__generated__/PromptAccessPageQuery.graphql";

export function PromptAccessPageContent({ promptId }: { promptId: string }) {
  const [fetchKey, setFetchKey] = useState(0);
  const [subjectSearch, setSubjectSearch] = useState("");
  const deferredSubjectSearch = useDeferredValue(subjectSearch.trim());

  const data = useLazyLoadQuery<PromptAccessPageQuery>(
    graphql`
      query PromptAccessPageQuery($promptId: ID!, $userFilter: UserFilter) {
        prompt: node(id: $promptId) {
          ... on Prompt {
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
        resourceTags(objectType: PROMPT, objectId: $promptId) {
          key
          value
        }
      }
    `,
    {
      promptId,
      userFilter: deferredSubjectSearch
        ? { value: deferredSubjectSearch }
        : null,
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  return (
    <ResourceAccessForm
      object={{ promptId }}
      grants={data.prompt?.accessGrants ?? []}
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
