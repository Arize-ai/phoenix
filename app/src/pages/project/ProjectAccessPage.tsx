import { useDeferredValue, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Navigate, useParams } from "react-router";

import { useViewerCanManageAccessControl } from "@phoenix/contexts";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";
import {
  buildSubjectItems,
  ResourceAccessForm,
} from "@phoenix/pages/access/ResourceAccessForm";

import type { ProjectAccessPageQuery } from "./__generated__/ProjectAccessPageQuery.graphql";

export function ProjectAccessPage() {
  const { projectId } = useParams();
  const canManageAccessControl = useViewerCanManageAccessControl();
  const { accessControlEnabled } = useFunctionality();
  if (!accessControlEnabled || !canManageAccessControl) {
    return <Navigate to={`/projects/${projectId}/spans`} replace />;
  }
  return <ProjectAccessPageContent projectId={projectId as string} />;
}

export function ProjectAccessPageContent({
  projectId,
  isModal = false,
}: {
  projectId: string;
  isModal?: boolean;
}) {
  const [fetchKey, setFetchKey] = useState(0);
  const [subjectSearch, setSubjectSearch] = useState("");
  const deferredSubjectSearch = useDeferredValue(subjectSearch.trim());

  const data = useLazyLoadQuery<ProjectAccessPageQuery>(
    graphql`
      query ProjectAccessPageQuery($projectId: ID!, $userFilter: UserFilter) {
        project: node(id: $projectId) {
          ... on Project {
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
        resourceTags(objectType: PROJECT, objectId: $projectId) {
          key
          value
        }
      }
    `,
    {
      projectId,
      userFilter: deferredSubjectSearch
        ? { value: deferredSubjectSearch }
        : null,
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  return (
    <ResourceAccessForm
      object={{ projectId }}
      grants={data.project?.accessGrants ?? []}
      tags={data.resourceTags}
      permissionSets={data.permissionSets}
      subjectItems={buildSubjectItems(
        data.users.edges.map((edge) => edge.user),
        data.userGroups
      )}
      onSubjectSearchChange={setSubjectSearch}
      onRefresh={() => setFetchKey((key) => key + 1)}
      isModal={isModal}
    />
  );
}
