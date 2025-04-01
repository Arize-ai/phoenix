import React, { Suspense } from "react";
import { graphql } from "react-relay";
import { useLazyLoadQuery } from "react-relay";

import { Card } from "@arizeai/components";

import { ContentSkeleton, ExternalLink, Flex, View } from "@phoenix/components";

interface ProjectAnnotationConfigCardProps {
  projectId: string;
}

export const ProjectAnnotationConfigCard = (
  props: ProjectAnnotationConfigCardProps
) => {
  return (
    <Card
      title="ProjectAnnotations"
      variant="compact"
      bodyStyle={{ padding: 0 }}
    >
      <View padding="size-200">
        <Suspense fallback={<ContentSkeleton />}>
          <ProjectAnnotationConfigCardContent projectId={props.projectId} />
        </Suspense>
      </View>
      <View padding="size-200" borderTopWidth="thin" borderColor="dark">
        <Flex direction="row" alignItems="end">
          <ExternalLink href="/annotation-configurations">
            Configure Annotations
          </ExternalLink>
        </Flex>
      </View>
    </Card>
  );
};

interface ProjectAnnotationConfigCardContentProps {
  projectId: string;
}

const ProjectAnnotationConfigCardContent = (
  props: ProjectAnnotationConfigCardContentProps
) => {
  const { projectId } = props;
  const data = useLazyLoadQuery(
    graphql`
      query ProjectAnnotationConfigCardContentQuery($projectId: GlobalID!) {
        project: node(id: $projectId) {
          ... on Project {
            annotationConfigs {
              edges {
                node {
                  name
                }
              }
            }
          }
        }
      }
    `,
    { projectId }
  );
  return (
    <div>
      <ContentSkeleton />
    </div>
  );
};
