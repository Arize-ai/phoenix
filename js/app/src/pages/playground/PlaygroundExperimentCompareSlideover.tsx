import { shallow } from "zustand/shallow";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useStableSearchParams } from "@phoenix/hooks";
import type { CompareLaneLiveRuns } from "@phoenix/pages/experiment/compareSlideover";
import {
  ExperimentCompareSlideover,
  useExperimentCompareSlideoverState,
} from "@phoenix/pages/experiment/compareSlideover";
import { arePlaygroundInstancesEqualExceptProgress } from "@phoenix/store/playground/selectors";

import { getPlaygroundCompareLaneLiveRuns } from "./playgroundCompareLaneLiveRuns";
import { usePlaygroundDatasetExamplesTableContext } from "./PlaygroundDatasetExamplesTableContext";

type ExperimentCompareSlideoverProps = Parameters<
  typeof ExperimentCompareSlideover
>[0];

/**
 * The experiment compare slideover over the Playground's tasks: the first
 * task is the base lane and the others are compared against it. The lanes
 * read the experiments the tasks recorded, and follow a run in progress
 * through the table's run state. The example drawer opens over the slideover,
 * which then leaves the keyboard to it.
 */
export function PlaygroundExperimentCompareSlideover(
  props: Pick<
    ExperimentCompareSlideoverProps,
    | "datasetId"
    | "navigationItems"
    | "totalItemCount"
    | "hasMoreItems"
    | "isLoadingMoreItems"
    | "onLoadMoreItems"
    | "onOpenTrace"
  >
) {
  const { state } = useExperimentCompareSlideoverState();
  const [searchParams] = useStableSearchParams();
  const selectedExampleId = state.selectedExampleId;
  const instances = usePlaygroundContext(
    (playgroundState) => playgroundState.instances,
    arePlaygroundInstancesEqualExceptProgress
  );
  const runExampleIds = usePlaygroundContext(
    (playgroundState) => playgroundState.runExampleIds
  );
  const repetitionCount = usePlaygroundDatasetExamplesTableContext(
    (tableState) => tableState.repetitions
  );
  const rowRunExperimentIds = usePlaygroundDatasetExamplesTableContext(
    (tableState) => tableState.rowRunExperimentIds
  );
  const responsesByInstance = usePlaygroundDatasetExamplesTableContext(
    (tableState) =>
      instances.map((instance) =>
        selectedExampleId != null
          ? tableState.exampleResponsesMap[instance.id]?.[selectedExampleId]
          : undefined
      ),
    shallow
  );
  if (selectedExampleId == null) {
    return null;
  }

  const isExampleInRun =
    runExampleIds == null || runExampleIds.includes(selectedExampleId);
  const experimentIds = instances.map(
    (instance) =>
      rowRunExperimentIds[instance.id]?.[selectedExampleId] ??
      instance.experiment?.id ??
      null
  );
  const liveRunsByExperimentId: Partial<Record<string, CompareLaneLiveRuns>> =
    {};
  instances.forEach((instance, index) => {
    const experimentId = experimentIds[index];
    if (experimentId != null) {
      liveRunsByExperimentId[experimentId] = getPlaygroundCompareLaneLiveRuns({
        responsesByRepetitionNumber: responsesByInstance[index],
        repetitionCount,
        isRunning: instance.activeRunId != null && isExampleInRun,
      });
    }
  });
  const [baseExperimentId = null, ...compareExperimentIds] = experimentIds;

  return (
    <ExperimentCompareSlideover
      {...props}
      baseExperimentId={baseExperimentId}
      compareExperimentIds={compareExperimentIds.flatMap(
        (experimentId) => experimentId ?? []
      )}
      liveRunsByExperimentId={liveRunsByExperimentId}
      isObscured={searchParams.has("exampleId")}
    />
  );
}
