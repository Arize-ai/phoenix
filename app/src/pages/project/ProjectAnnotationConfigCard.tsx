import React, { startTransition, Suspense, useCallback } from "react";
import {
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRefetchableFragment,
} from "react-relay";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import { ContentSkeleton, Flex, Link, Text, View } from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";

import { ProjectAnnotationConfigCardContent_project_annotations$key } from "./__generated__/ProjectAnnotationConfigCardContent_project_annotations.graphql";
import { ProjectAnnotationConfigCardContentAddAnnotationConfigToProjectMutation } from "./__generated__/ProjectAnnotationConfigCardContentAddAnnotationConfigToProjectMutation.graphql";
import { ProjectAnnotationConfigCardContentProjectAnnotationsQuery } from "./__generated__/ProjectAnnotationConfigCardContentProjectAnnotationsQuery.graphql";
import { ProjectAnnotationConfigCardContentQuery } from "./__generated__/ProjectAnnotationConfigCardContentQuery.graphql";
import { ProjectAnnotationConfigCardContentRemoveAnnotationConfigFromProjectMutation } from "./__generated__/ProjectAnnotationConfigCardContentRemoveAnnotationConfigFromProjectMutation.graphql";
interface ProjectAnnotationConfigCardProps {
  projectId: string;
}

export const ProjectAnnotationConfigCard = (
  props: ProjectAnnotationConfigCardProps
) => {
  return (
    <Card
      title="Project Annotations"
      variant="compact"
      bodyStyle={{ padding: 0 }}
    >
      <View padding="size-200">
        <Suspense fallback={<ContentSkeleton />}>
          <ProjectAnnotationConfigCardContent projectId={props.projectId} />
        </Suspense>
      </View>
      <View
        paddingX="size-200"
        paddingY="size-100"
        borderTopWidth="thin"
        borderColor="dark"
      >
        <Flex direction="row" justifyContent="end">
          <Link to="/settings/annotations">Configure Annotation Configs</Link>
        </Flex>
      </View>
    </Card>
  );
};

const annotationLabelCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-size-100);
`;

interface ProjectAnnotationConfigCardContentProps {
  projectId: string;
}

const ProjectAnnotationConfigCardContent = (
  props: ProjectAnnotationConfigCardContentProps
) => {
  const { projectId } = props;
  const data = useLazyLoadQuery<ProjectAnnotationConfigCardContentQuery>(
    graphql`
      query ProjectAnnotationConfigCardContentQuery($projectId: GlobalID!) {
        project: node(id: $projectId) {
          ... on Project {
            ...ProjectAnnotationConfigCardContent_project_annotations
          }
        }
        allAnnotationConfigs: annotationConfigs {
          edges {
            node {
              ... on Node {
                id
              }
              ... on AnnotationConfigBase {
                name
                annotationType
              }
            }
          }
        }
      }
    `,
    { projectId }
  );

  const [projectAnnotationData] = useRefetchableFragment<
    ProjectAnnotationConfigCardContentProjectAnnotationsQuery,
    ProjectAnnotationConfigCardContent_project_annotations$key
  >(
    graphql`
      fragment ProjectAnnotationConfigCardContent_project_annotations on Project
      @refetchable(
        queryName: "ProjectAnnotationConfigCardContentProjectAnnotationsQuery"
      ) {
        annotationConfigs {
          edges {
            node {
              ... on AnnotationConfigBase {
                name
              }
            }
          }
        }
      }
    `,
    data.project
  );

  const [addAnnotationConfigToProjectiMutation] =
    useMutation<ProjectAnnotationConfigCardContentAddAnnotationConfigToProjectMutation>(
      graphql`
        mutation ProjectAnnotationConfigCardContentAddAnnotationConfigToProjectMutation(
          $projectId: GlobalID!
          $annotationConfigId: GlobalID!
        ) {
          addAnnotationConfigToProject(
            input: {
              projectId: $projectId
              annotationConfigId: $annotationConfigId
            }
          ) {
            project {
              ...ProjectAnnotationConfigCardContent_project_annotations
            }
          }
        }
      `
    );

  const [removeAnnotationConfigFromProjectMutation] =
    useMutation<ProjectAnnotationConfigCardContentRemoveAnnotationConfigFromProjectMutation>(
      graphql`
        mutation ProjectAnnotationConfigCardContentRemoveAnnotationConfigFromProjectMutation(
          $projectId: GlobalID!
          $annotationConfigId: GlobalID!
        ) {
          removeAnnotationConfigFromProject(
            input: {
              projectId: $projectId
              annotationConfigId: $annotationConfigId
            }
          ) {
            project {
              ...ProjectAnnotationConfigCardContent_project_annotations
            }
          }
        }
      `
    );

  const addAnnotationConfigToProject = useCallback(
    (annotationConfigId: string) => {
      startTransition(() => {
        addAnnotationConfigToProjectiMutation({
          variables: {
            projectId,
            annotationConfigId,
          },
        });
      });
    },
    [projectId, addAnnotationConfigToProjectiMutation]
  );

  const removeAnnotationConfigFromProject = useCallback(
    (annotationConfigId: string) => {
      removeAnnotationConfigFromProjectMutation({
        variables: {
          projectId,
          annotationConfigId,
        },
      });
    },
    [projectId, removeAnnotationConfigFromProjectMutation]
  );

  const { allAnnotationConfigs } = data;
  const projectAnnotationConfigNames =
    projectAnnotationData?.annotationConfigs?.edges.map(
      (edge) => edge?.node?.name
    ) || [];
  if (allAnnotationConfigs.edges.length === 0) {
    return (
      <Flex direction="row" justifyContent="center">
        <Text>No annotation configurations available.</Text>
      </Flex>
    );
  }
  return (
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--ac-global-dimension-size-100);
      `}
    >
      {allAnnotationConfigs.edges.map((edge) => {
        return (
          <li key={edge.node.name}>
            <Flex direction="row" alignItems="center">
              <label css={annotationLabelCSS}>
                <input
                  type="checkbox"
                  checked={projectAnnotationConfigNames.includes(
                    edge.node.name
                  )}
                  onChange={(e) => {
                    const annotationConfigId = edge.node.id;
                    if (!annotationConfigId) {
                      throw new Error("Annotation config ID is required");
                    }
                    if (e.target.checked) {
                      addAnnotationConfigToProject(annotationConfigId);
                    } else {
                      removeAnnotationConfigFromProject(annotationConfigId);
                    }
                  }}
                />
                <AnnotationLabel
                  key={edge.node.name}
                  annotation={{
                    name: edge.node.name || "",
                  }}
                  annotationDisplayPreference="none"
                  css={css`
                    width: fit-content;
                  `}
                />
              </label>
            </Flex>
          </li>
        );
      })}
    </ul>
  );
};
