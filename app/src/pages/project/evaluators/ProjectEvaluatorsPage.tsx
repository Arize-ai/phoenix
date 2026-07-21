import { css } from "@emotion/react";
import { Suspense } from "react";
import { useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Flex, Loading, View } from "@phoenix/components";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import type { projectEvaluatorsLoader } from "@phoenix/pages/project/evaluators/projectEvaluatorsLoader";
import { projectEvaluatorsLoaderGQL } from "@phoenix/pages/project/evaluators/projectEvaluatorsLoader";
import {
  ProjectEvaluatorsTable,
  useProjectEvaluatorsTable,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorsTable";

/**
 * Lists the evaluators that run against a project's live spans, traces, and sessions.
 */
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
      <View padding="size-100" flex="none">
        <Flex direction="row" justifyContent="end">
          <AddProjectEvaluatorMenu size="M" projectId={projectId} />
        </Flex>
      </View>
      <Suspense fallback={<Loading />}>
        <ProjectEvaluatorsPageContent />
      </Suspense>
    </main>
  );
}

function ProjectEvaluatorsPageContent() {
  const loaderData = useLoaderData<typeof projectEvaluatorsLoader>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery({
    query: projectEvaluatorsLoaderGQL,
    queryRef: loaderData,
  });
  const tableProps = useProjectEvaluatorsTable(data.project);
  return <ProjectEvaluatorsTable {...tableProps} />;
}
