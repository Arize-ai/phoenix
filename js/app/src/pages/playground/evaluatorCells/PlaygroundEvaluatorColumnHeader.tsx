import { css } from "@emotion/react";
import { useMemo } from "react";

import { getInstanceLabel } from "@phoenix/agent/tools/playgroundPrompt";
import {
  ContextualHelp,
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
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

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
  truncatedExampleCount,
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
  /** Every example of the dataset, loaded into the table or not. */
  examples: ReadonlyArray<ExpectedOutputExample>;
  /**
   * The dataset's example count when it has more examples than `examples`
   * holds, so the counts cover only those; null when they cover them all.
   */
  truncatedExampleCount: number | null;
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
    <div className="evaluator-column-header" css={evaluatorColumnHeaderCSS}>
      <Flex direction="column" gap="size-50" width="100%">
        <Flex
          direction="row"
          gap="size-100"
          alignItems="start"
          justifyContent="space-between"
          minWidth={0}
          width="100%"
        >
          <Flex direction="column" gap="size-25" minWidth={0} flex={1}>
            <Flex direction="row" gap="size-100" alignItems="center">
              <AlphabeticIndexIcon index={index} size="XS" />
              <Truncate maxWidth="100%">{name}</Truncate>
              {errorCount > 0 ? (
                <Counter variant="danger">{errorCount}</Counter>
              ) : null}
            </Flex>
            {/* One line, always: the counts change with every annotation, and a
            line that wrapped moved the header and every row beneath it. */}
            <Flex
              direction="row"
              gap="size-75"
              alignItems="center"
              minWidth={0}
            >
              <Truncate maxWidth="100%">
                <Text size="XS" color="text-500" weight="normal">
                  {agreement.withExpected}/{exampleCount}
                  {/* The info icon after the line says what it marks. */}
                  {truncatedExampleCount != null ? (
                    <sup aria-hidden="true" css={capMarkerCSS}>
                      *
                    </sup>
                  ) : null}{" "}
                  with expected
                  {agreementText}
                </Text>
              </Truncate>
              {/* Outside the truncation, so it never gets cut off. */}
              {truncatedExampleCount != null ? (
                <span
                  className="evaluator-column-header__cap-info"
                  css={capInfoCSS}
                >
                  <ContextualHelp
                    variant="info"
                    placement="bottom"
                    triggerAriaLabel="Which examples these counts cover"
                  >
                    <Text>
                      Counted over the first {intFormatter(examples.length)} of{" "}
                      {intFormatter(truncatedExampleCount)} examples.
                    </Text>
                  </ContextualHelp>
                </span>
              ) : null}
            </Flex>
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
    </div>
  );
}

// The table sizes its columns to their content, so a header whose numbers
// widen as results stream in would widen its column and shift every row
// sideways. Containment keeps the column at the width it was given; what does
// not fit truncates.
const evaluatorColumnHeaderCSS = css`
  contain: inline-size;
  width: 100%;
`;

// A superscript, and the info button beside the line, are a little taller than
// the line itself; neither may make the header taller than it is without them.
const capMarkerCSS = css`
  line-height: 0;
`;

const capInfoCSS = css`
  display: flex;
  align-items: center;
  height: 0;
`;
