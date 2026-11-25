import { css } from "@emotion/react";

import {
  Card,
  CopyToClipboardButton,
  ExpandableContent,
  Flex,
  Icon,
  Icons,
  View,
} from "@phoenix/components";
import { ExperimentOutputContent } from "@phoenix/components/experiment/ExperimentOutputContent";
import { PrettyText } from "@phoenix/components/utility/PrettyText";
import { assertUnreachable } from "@phoenix/typeUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import { ExperimentCompareLaneEmpty } from "./ExperimentCompareLaneEmpty";
import { getCompareLaneRunState } from "./experimentCompareLaneRuns";
import type { CompareLane } from "./experimentCompareLaneTypes";
import { useExperimentCompareLaneRunGroup } from "./useExperimentCompareLaneRunGroup";

/** About 16 lines of body text */
const COLLAPSED_OUTPUT_HEIGHT_PX = 320;

const errorIconCSS = css`
  flex: none;
`;

function formatOutput(output: unknown): string {
  return typeof output === "string" ? output : JSON.stringify(output, null, 2);
}

/**
 * A lane's Output cell: the shown run's output, or its error. Long outputs
 * are clamped, and the expanded state is the caller's so both lanes open and
 * close together and stay aligned.
 */
export function ExperimentCompareLaneOutput({
  exampleId,
  lane,
  isExpanded,
  onExpandedChange,
}: {
  exampleId: string;
  lane: CompareLane;
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
}) {
  const runGroup = useExperimentCompareLaneRunGroup({
    exampleId,
    experimentId: lane.experiment.id,
  });
  const runState = getCompareLaneRunState({
    runs: runGroup.runs,
    shownRepetitionNumber: lane.shownRepetitionNumber,
  });
  switch (runState.type) {
    case "no-runs":
      return <ExperimentCompareLaneEmpty message="No run for this example" />;
    case "missing-repetition":
      return (
        <ExperimentCompareLaneEmpty message="No run for this repetition" />
      );
    case "errored":
      return (
        <Card
          title="Output"
          extra={<CopyToClipboardButton text={runState.run.error ?? ""} />}
        >
          <View padding="size-200">
            <Flex direction="row" gap="size-100" alignItems="start">
              <Icon
                svg={<Icons.AlertCircle />}
                color="danger"
                role="img"
                aria-label="Error"
                css={errorIconCSS}
              />
              <View flex="1" minWidth={0}>
                <PrettyText>{runState.run.error ?? ""}</PrettyText>
              </View>
            </Flex>
          </View>
        </Card>
      );
    case "completed": {
      const outputText = formatOutput(runState.run.output);
      return (
        <Card
          title="Output"
          subTitle={`${intFormatter(outputText.length)} chars`}
          extra={<CopyToClipboardButton text={outputText} />}
        >
          <ExpandableContent
            height={COLLAPSED_OUTPUT_HEIGHT_PX}
            expandedBehavior="grow"
            isExpanded={isExpanded}
            onExpandedChange={onExpandedChange}
          >
            <View padding="size-200">
              <ExperimentOutputContent value={runState.run.output} />
            </View>
          </ExpandableContent>
        </Card>
      );
    }
    default:
      return assertUnreachable(runState);
  }
}
