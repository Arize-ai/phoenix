import { css } from "@emotion/react";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { Empty, Flex, View } from "@phoenix/components";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";

/**
 * Lists the evaluators that run against a project's live spans, traces, and
 * sessions. The list itself is not built yet — the tab currently offers the
 * create flow with a stubbed submit.
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
      <Empty message="No evaluators are set up for this project" />
    </main>
  );
}
