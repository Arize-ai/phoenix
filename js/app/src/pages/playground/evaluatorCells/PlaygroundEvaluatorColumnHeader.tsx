import { getInstanceLabel } from "@phoenix/agent/tools/playgroundPrompt";
import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import type { EvaluatorOutput } from "../evaluators/evaluatorResults";
import { usePlaygroundDatasetExamplesTableContext } from "../PlaygroundDatasetExamplesTableContext";
import { PlaygroundInstanceProgressIndicator } from "../PlaygroundInstanceProgressIndicator";
import {
  type ExpectedOutputExample,
  summarizeExpectedAgreement,
} from "./evaluatorCellResults";
import { usePlaygroundExpectedOutputs } from "./PlaygroundExpectedOutputsContext";

/**
 * An evaluator task's column header: which task it is, how it is doing
 * against the expected outputs of the loaded examples, and the play button
 * that runs this task alone. Keeping the metrics here means they scale with
 * the number of evaluators instead of crowding a shared summary strip.
 */
export function PlaygroundEvaluatorColumnHeader({
  instanceId,
  index,
  name,
  annotationName,
  output,
  examples,
  isRunning,
  canRun,
  onRun,
}: {
  instanceId: number;
  index: number;
  name: string;
  annotationName: string;
  output: EvaluatorOutput | undefined;
  examples: ReadonlyArray<ExpectedOutputExample>;
  isRunning: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  const responses = usePlaygroundDatasetExamplesTableContext(
    (state) => state.exampleResponsesMap[instanceId]
  );

  // The tooltip says what a run of this column does with the Record switch
  // as it stands.
  const recordExperiments = usePlaygroundContext(
    (state) => state.recordExperiments
  );

  const { overlay } = usePlaygroundExpectedOutputs();

  const agreement = summarizeExpectedAgreement({
    examples,
    responses,
    pendingExpectedOutputs: overlay,
    annotationName,
    output,
  });

  // Examples with a persisted expected output. This is dataset state, so it
  // survives a reload while run results do not — hence "with expected", not
  // "reviewed", which would imply someone looked at this run.
  const hasResults = responses != null && Object.keys(responses).length > 0;

  const agreementText =
    hasResults && agreement.comparable > 0
      ? ` · ${agreement.matches}/${agreement.comparable} agree`
      : "";

  const label = getInstanceLabel(index);

  return (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="start"
      justifyContent="space-between"
      minWidth={0}
      width="100%"
    >
      <Flex direction="column" gap="size-25" minWidth={0}>
        <Flex direction="row" gap="size-100" alignItems="center">
          <AlphabeticIndexIcon index={index} size="XS" />
          <Truncate maxWidth="100%">{name}</Truncate>
        </Flex>
        <Text size="XS" color="text-500" weight="normal">
          {agreement.withExpected}/{examples.length} with expected
          {agreementText}
        </Text>
      </Flex>
      {isRunning ? (
        <View flex="none">
          <PlaygroundInstanceProgressIndicator instanceId={instanceId} />
        </View>
      ) : (
        <TooltipTrigger>
          <IconButton
            size="S"
            aria-label={`Run evaluator ${label} on all examples`}
            isDisabled={!canRun}
            onPress={onRun}
          >
            <Icon svg={<Icons.Play />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            Run evaluator {label} on all examples.{" "}
            {recordExperiments ? "Recorded." : "Not recorded."}
          </Tooltip>
        </TooltipTrigger>
      )}
    </Flex>
  );
}
