import { css } from "@emotion/react";
import { Suspense } from "react";
import { Navigate, Outlet } from "react-router";

import { View } from "@phoenix/components";
import { CodeEvaluatorVersions } from "@phoenix/components/evaluators/CodeEvaluatorVersions";
import {
  evaluatorSplitContainerCSS,
  evaluatorSplitLayoutCSS,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import { AnnotationConfigurationCard } from "@phoenix/pages/project/evaluators/AnnotationConfigurationCard";
import { CodeProjectEvaluatorConfigCards } from "@phoenix/pages/project/evaluators/CodeProjectEvaluatorConfigCards";
import { CodeProjectEvaluatorDetails } from "@phoenix/pages/project/evaluators/CodeProjectEvaluatorDetails";
import { DecisionProjectEvaluatorDetails } from "@phoenix/pages/project/evaluators/DecisionProjectEvaluatorDetails";
import { LLMProjectEvaluatorDetails } from "@phoenix/pages/project/evaluators/LLMProjectEvaluatorDetails";
import { ProjectEvaluatorAdvancedDetails } from "@phoenix/pages/project/evaluators/ProjectEvaluatorAdvancedDetails";
import { useProjectEvaluatorDetailsOutletContext } from "@phoenix/pages/project/evaluators/projectEvaluatorDetailsOutletContext";
import { ProjectEvaluatorMetrics } from "@phoenix/pages/project/evaluators/ProjectEvaluatorMetrics";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { ProjectEvaluatorScopeDetails } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeDetails";
import { ProjectEvaluatorStats } from "@phoenix/pages/project/evaluators/ProjectEvaluatorStats";
import { ProjectEvaluatorTraces } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTraces";

/**
 * Centers the overview and establishes the width queried by its responsive
 * main-and-sidebar layout. Stacks the stats strip above the split layout.
 */
export const overviewContainerCSS = css`
  ${evaluatorSplitContainerCSS};
  max-width: 1600px;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
`;

const overviewColumnCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  min-width: 0;
`;

/**
 * The drawers and slideovers nested under a tab route, opened over the tab.
 * They load on their own, so the tab behind them stays in place meanwhile.
 */
function TabOverlayOutlet() {
  const context = useProjectEvaluatorDetailsOutletContext();
  return (
    <Suspense>
      <Outlet context={context} />
    </Suspense>
  );
}

/** The overview tab: the stats strip over the evaluator's configuration. */
export function ProjectEvaluatorOverviewTab() {
  const { projectEvaluator, timeRange, onTimeRangeSelected } =
    useProjectEvaluatorDetailsOutletContext();
  const { kind } = projectEvaluator.evaluator;
  return (
    <>
      <View width="100%" overflow="auto" height="100%">
        <View padding="size-200">
          <div css={overviewContainerCSS}>
            <ProjectEvaluatorStats
              projectEvaluatorRef={projectEvaluator}
              timeRange={timeRange}
              onTimeRangeSelected={onTimeRangeSelected}
            />
            <div css={evaluatorSplitLayoutCSS}>
              <div css={overviewColumnCSS}>
                {kind === "LLM" && (
                  <LLMProjectEvaluatorDetails
                    projectEvaluatorRef={projectEvaluator}
                  />
                )}
                {kind === "CODE" && (
                  <CodeProjectEvaluatorDetails
                    projectEvaluatorRef={projectEvaluator}
                  />
                )}
                {kind === "DECISION" && (
                  <DecisionProjectEvaluatorDetails
                    projectEvaluatorRef={projectEvaluator}
                  />
                )}
              </div>
              <aside css={overviewColumnCSS}>
                <ProjectEvaluatorScopeDetails
                  projectEvaluatorRef={projectEvaluator}
                />
                <ProjectEvaluatorAdvancedDetails
                  projectEvaluatorRef={projectEvaluator}
                />
                <AnnotationConfigurationCard
                  projectEvaluatorRef={projectEvaluator}
                />
                {kind === "CODE" && (
                  <CodeProjectEvaluatorConfigCards
                    projectEvaluatorRef={projectEvaluator}
                  />
                )}
              </aside>
            </div>
          </div>
        </View>
      </View>
      <TabOverlayOutlet />
    </>
  );
}

/**
 * The versions tab, which only code evaluators have. Any other evaluator's
 * versions link lands on its overview.
 */
export function ProjectEvaluatorVersionsTab() {
  const { projectEvaluator } = useProjectEvaluatorDetailsOutletContext();
  const paths = useProjectEvaluatorPaths();
  const { evaluator } = projectEvaluator;
  if (evaluator.kind !== "CODE" || evaluator.id == null) {
    return <Navigate to={paths.details(projectEvaluator.id)} replace />;
  }
  return (
    <>
      <CodeEvaluatorVersions codeEvaluatorId={evaluator.id} />
      <TabOverlayOutlet />
    </>
  );
}

/** The traces tab: the traces the evaluator's own runs produced. */
export function ProjectEvaluatorTracesTab() {
  const { projectEvaluator } = useProjectEvaluatorDetailsOutletContext();
  return (
    <>
      <ProjectEvaluatorTraces
        projectId={projectEvaluator.traceProject.id}
        projectEvaluatorId={projectEvaluator.id}
        hasEverRun={projectEvaluator.runSummary.status !== "NEVER_RUN"}
        isTracingEnabled={projectEvaluator.tracingEnabled}
      />
      <TabOverlayOutlet />
    </>
  );
}

/** The metrics tab: the evaluator's results and runs over time. */
export function ProjectEvaluatorMetricsTab() {
  const { projectEvaluator, timeRange, onTimeRangeSelected } =
    useProjectEvaluatorDetailsOutletContext();
  return (
    <>
      <ProjectEvaluatorMetrics
        projectEvaluator={projectEvaluator}
        timeRange={timeRange}
        onTimeRangeSelected={onTimeRangeSelected}
      />
      <TabOverlayOutlet />
    </>
  );
}
