import { useMemo } from "react";

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
import type { AnnotationConfig } from "@phoenix/components/annotation";
import { Counter } from "@phoenix/components/core/counter";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import type { EvaluatorOutput } from "../evaluators/evaluatorResults";
import { usePlaygroundDatasetExamplesTableContext } from "../PlaygroundDatasetExamplesTableContext";
import { PlaygroundInstanceProgressIndicator } from "../PlaygroundInstanceProgressIndicator";
import { PlaygroundInstanceRunAggregates } from "../PlaygroundInstanceRunAggregates";
import {
  type ExpectedOutputExample,
  summarizeExpectedAgreement,
} from "./evaluatorCellResults";
import { usePlaygroundExpectedOutputs } from "./PlaygroundExpectedOutputsContext";

/**
 * An evaluator task's column header: which task it is, how it is doing
 * against the expected outputs of the dataset's examples, the play button
 * that runs this task alone, and the stat strip of its last run. Keeping the
 * metrics here means they scale with the number of evaluators instead of
 * crowding a shared summary strip.
 */
export function PlaygroundEvaluatorColumnHeader({
  instanceId,
  index,
  name,
  annotationName,
  annotationConfig,
  output,
  experimentId,
  exampleCount,
  examples,
  isRunning,
  canRun,
  onRun,
}: {
  instanceId: number;
  index: number;
  name: string;
  annotationName: string;
  annotationConfig: AnnotationConfig | undefined;
  output: EvaluatorOutput | undefined;
  experimentId: string | null | undefined;
  /** How many examples the dataset (or its selected splits) has. */
  exampleCount: number;
  /** Every example with an expected output, loaded into the table or not. */
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

  const errorCount = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)
        ?.experimentRunProgress?.runsFailed ?? 0
  );

  const { overlay } = usePlaygroundExpectedOutputs();

  // Walks every example, so not on every render of a header that re-renders
  // with each streamed result.
  const agreement = useMemo(
    () =>
      summarizeExpectedAgreement({
        examples,
        responses,
        pendingExpectedOutputs: overlay,
        annotationName,
        output,
      }),
    [examples, responses, overlay, annotationName, output]
  );

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
    <Flex direction="column" gap="size-50" width="100%">
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
            {errorCount > 0 ? (
              <Counter variant="danger">{errorCount}</Counter>
            ) : null}
          </Flex>
          {/* One line, always: the counts change with every annotation, and a
            line that wrapped moved the header and every row beneath it. */}
          <Truncate maxWidth="100%">
            <Text size="XS" color="text-500" weight="normal">
              {agreement.withExpected}/{exampleCount} with expected
              {agreementText}
            </Text>
          </Truncate>
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
      <PlaygroundInstanceRunAggregates
        instanceId={instanceId}
        experimentId={experimentId}
        isRunning={isRunning}
        annotationConfigs={annotationConfig ? [annotationConfig] : []}
      />
    </Flex>
  );
}
