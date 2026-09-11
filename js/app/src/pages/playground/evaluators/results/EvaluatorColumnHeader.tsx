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
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";
import { Truncate } from "@phoenix/components/core/utility/Truncate";

import type {
  SampleExample,
  EvaluatorRun,
  ExpectedOutput,
} from "../evaluatorResults";
import { getExpectedVerdict } from "../evaluatorResults";
import type { SlotId, SlotOutput } from "../evaluatorSlotTypes";
import { getSlotIndex } from "../evaluatorSlotTypes";

/**
 * An evaluator's column header: who it is, how it is doing against the
 * expected outputs so far, and the play button that runs it down the whole
 * sample. Keeping the metrics here means they scale with the number of
 * evaluators instead of crowding a shared summary strip.
 */
export function EvaluatorColumnHeader({
  slot,
  name,
  run,
  expected,
  output,
  examples,
  canRun,
  onRun,
}: {
  slot: SlotId;
  name?: string;
  run?: EvaluatorRun;
  expected?: Partial<Record<string, ExpectedOutput>>;
  output?: SlotOutput;
  examples: SampleExample[];
  canRun: boolean;
  onRun: () => void;
}) {
  // Examples with a persisted expected output. This is dataset state, so it
  // survives a reload while run results do not — hence "with expected", not
  // "reviewed", which would imply someone looked at this run.
  const withExpected = examples.filter((example) => expected?.[example.id]);

  // Agreement is counted over examples whose expectation the output config
  // can still produce, and says so: "2/2 agree" can't be mistaken for a share
  // of the whole sample.
  const verdicts = withExpected.map((example) =>
    getExpectedVerdict({
      prediction: run?.predictions[example.id],
      expected: expected?.[example.id],
      output,
    })
  );

  const comparable = verdicts.filter((verdict) => verdict !== "invalid");
  const matches = comparable.filter((verdict) => verdict === "match").length;

  const agreement =
    run && comparable.length ? `${matches}/${comparable.length} agree` : null;

  return (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="start"
      justifyContent="space-between"
      minWidth={0}
    >
      <Flex direction="column" gap="size-25" minWidth={0}>
        <Flex direction="row" gap="size-100" alignItems="center">
          <AlphabeticIndexIcon index={getSlotIndex(slot)} size="XS" />
          <Truncate maxWidth="100%">{name || `Evaluator ${slot}`}</Truncate>
        </Flex>
        <Text size="XS" color="text-500" weight="normal">
          {withExpected.length}/{examples.length} with expected
          {agreement ? ` · ${agreement}` : ""}
        </Text>
      </Flex>
      {run?.isRunning ? (
        <View flex="none" paddingY="size-50">
          <ProgressCircle isIndeterminate size="S" aria-label="Running" />
        </View>
      ) : (
        <TooltipTrigger>
          <IconButton
            size="S"
            aria-label={`Run evaluator ${slot} on all examples`}
            isDisabled={!canRun}
            onPress={onRun}
          >
            <Icon svg={<Icons.Play />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            Run evaluator {slot} on all examples
          </Tooltip>
        </TooltipTrigger>
      )}
    </Flex>
  );
}
