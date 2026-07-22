import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { Flex, Skeleton, View } from "@phoenix/components";
import type { ProjectEvaluatorsPageQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsPageQuery.graphql";
import { ProjectEvaluatorsTable } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsTable";

export function ProjectEvaluatorsPage() {
  const { projectId } = useParams();
  invariant(projectId, "projectId is required");
  return (
    <main
      css={css`
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
      `}
    >
      <Suspense fallback={<ProjectEvaluatorsPageSkeleton />}>
        <ProjectEvaluatorsPageContent projectId={projectId} />
      </Suspense>
    </main>
  );
}

function ProjectEvaluatorsPageContent({ projectId }: { projectId: string }) {
  const data = useLazyLoadQuery<ProjectEvaluatorsPageQuery>(
    graphql`
      query ProjectEvaluatorsPageQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            ...ProjectEvaluatorsTable_project
          }
        }
      }
    `,
    { projectId },
    { fetchPolicy: "store-and-network" }
  );
  invariant(data.project, "project is required");
  return (
    <ProjectEvaluatorsTable project={data.project} projectId={projectId} />
  );
}

function ProjectEvaluatorsPageSkeleton() {
  return (
    <>
      <View padding="size-100" flex="none">
        <Flex direction="row" justifyContent="end">
          <Skeleton width={130} height={32} />
        </Flex>
      </View>
      <View padding="size-100">
        <Skeleton width="100%" height={180} animation="wave" />
      </View>
    </>
  );
}
