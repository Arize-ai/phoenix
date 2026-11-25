import { css } from "@emotion/react";
import type { SetStateAction } from "react";
import { Suspense } from "react";

import {
  Icon,
  IconButton,
  Icons,
  Skeleton,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { ExperimentNameWithColorSwatch } from "@phoenix/components/experiment/ExperimentNameWithColorSwatch";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";
import { ExperimentRepetitionSelector } from "@phoenix/pages/experiment/ExperimentRepetitionSelector";

import type { ExperimentCompareLanePickerOption } from "./ExperimentCompareLanePicker";
import { ExperimentCompareLanePicker } from "./ExperimentCompareLanePicker";
import {
  getCompareLaneRunState,
  getShownRun,
} from "./experimentCompareLaneRuns";
import type { CompareLane } from "./experimentCompareLaneTypes";
import { useExperimentCompareLaneRunGroup } from "./useExperimentCompareLaneRunGroup";

const laneHeaderCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  min-height: var(--global-dimension-size-500);
  box-sizing: border-box;
  padding: 0 var(--global-dimension-size-100) 0 var(--global-dimension-size-200);

  .experiment-compare-lane-header__identity {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    flex: 1 1 auto;
    min-width: 0;
  }

  .experiment-compare-lane-header__controls {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    flex: none;
  }
`;

function LaneRunTraceButton({
  exampleId,
  lane,
  onPress,
}: {
  exampleId: string;
  lane: CompareLane;
  onPress: () => void;
}) {
  const runGroup = useExperimentCompareLaneRunGroup({
    exampleId,
    experimentId: lane.experiment.id,
  });
  const shownRun = getShownRun(
    getCompareLaneRunState({
      runs: runGroup.runs,
      shownRepetitionNumber: lane.shownRepetitionNumber,
    })
  );
  const hasTrace = shownRun?.trace != null;
  return (
    <TooltipTrigger isDisabled={!hasTrace}>
      <IconButton
        size="S"
        aria-label="View run trace"
        isDisabled={!hasTrace}
        onPress={onPress}
      >
        <Icon svg={<Icons.Trace />} />
      </IconButton>
      <Tooltip>View run trace</Tooltip>
    </TooltipTrigger>
  );
}

/**
 * The row above a lane: which experiment it shows, its repetition stepper,
 * and a button to its run trace. The base lane names its experiment; the
 * compare lane picks among the compared experiments.
 */
export function ExperimentCompareLaneHeader({
  exampleId,
  lane,
  pickerOptions,
  onCompareExperimentChange,
  onRepetitionNumberChange,
  onViewRunTrace,
}: {
  exampleId: string;
  lane: CompareLane;
  /** The experiments the compare lane can show; one option renders no picker */
  pickerOptions: readonly ExperimentCompareLanePickerOption[];
  onCompareExperimentChange: (experimentId: string) => void;
  onRepetitionNumberChange: (repetitionNumber: number) => void;
  /** Shows the lane's run trace; omitted when traces are already showing */
  onViewRunTrace?: () => void;
}) {
  const { experiment, shownRepetitionNumber } = lane;
  const hasPicker = lane.side === "compare" && pickerOptions.length > 1;
  return (
    <div className="experiment-compare-lane-header" css={laneHeaderCSS}>
      {hasPicker ? (
        <ExperimentCompareLanePicker
          options={pickerOptions}
          selectedExperimentId={experiment.id}
          onSelectionChange={onCompareExperimentChange}
        />
      ) : (
        <div className="experiment-compare-lane-header__identity">
          <SequenceNumberToken sequenceNumber={experiment.sequenceNumber} />
          <ExperimentNameWithColorSwatch
            name={experiment.name}
            color={lane.color}
            isBaseline={lane.side === "base"}
          />
        </div>
      )}
      <div className="experiment-compare-lane-header__controls">
        {experiment.repetitions > 1 ? (
          <ExperimentRepetitionSelector
            repetitionNumber={shownRepetitionNumber}
            totalRepetitions={experiment.repetitions}
            setRepetitionNumber={(action: SetStateAction<number>) =>
              onRepetitionNumberChange(
                typeof action === "function"
                  ? action(shownRepetitionNumber)
                  : action
              )
            }
          />
        ) : null}
        {onViewRunTrace != null ? (
          <Suspense
            fallback={
              <Skeleton
                width="var(--global-dimension-size-300)"
                height="var(--global-dimension-size-300)"
              />
            }
          >
            <LaneRunTraceButton
              exampleId={exampleId}
              lane={lane}
              onPress={onViewRunTrace}
            />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}
