import {
  Card,
  CopyToClipboardButton,
  ExpandableContent,
  View,
} from "@phoenix/components";
import { ExperimentOutputContent } from "@phoenix/components/experiment/ExperimentOutputContent";
import { ExperimentRunErrorContent } from "@phoenix/pages/experiment/ExperimentRunErrorContent";
import { assertUnreachable } from "@phoenix/typeUtils";
import { formatContentAsString } from "@phoenix/utils/jsonUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import { ExperimentCompareLaneEmpty } from "./ExperimentCompareLaneEmpty";
import type { CompareLane } from "./experimentCompareLaneTypes";
import { useCompareLaneRun } from "./useExperimentCompareLaneRunGroup";

/** About 16 lines of body text */
const COLLAPSED_OUTPUT_HEIGHT_PX = 320;

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
  const { runState } = useCompareLaneRun({ exampleId, lane });
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
            <ExperimentRunErrorContent error={runState.run.error ?? ""} />
          </View>
        </Card>
      );
    case "completed": {
      const outputText = formatContentAsString(runState.run.output, {
        unquotePlainString: true,
      });
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
