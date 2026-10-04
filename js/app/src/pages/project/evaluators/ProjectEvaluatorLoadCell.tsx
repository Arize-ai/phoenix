import type { TextProps } from "@phoenix/components";
import {
  Flex,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { formatPercentShort } from "@phoenix/utils/numberFormatUtils";

export type ProjectEvaluatorEvaluationLoad = {
  evaluationsPerMinute: number;
  meanEvaluationSeconds: number | null;
  shareOfEvaluationTime: number | null;
};

const rateFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});
const secondsFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

/**
 * The share of the server's evaluation time this evaluator used over the last
 * hour, with its rate and mean evaluation time on hover. Shown as `--` before
 * it has evaluated anything in that hour.
 */
export function ProjectEvaluatorLoad({
  evaluationLoad,
  size,
  fontFamily,
}: {
  evaluationLoad: ProjectEvaluatorEvaluationLoad;
} & Pick<TextProps, "size" | "fontFamily">) {
  const { evaluationsPerMinute, meanEvaluationSeconds, shareOfEvaluationTime } =
    evaluationLoad;
  if (shareOfEvaluationTime == null || meanEvaluationSeconds == null) {
    return (
      <Text size={size} fontFamily={fontFamily} color="text-700">
        --
      </Text>
    );
  }
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <Text size={size} fontFamily={fontFamily}>
          {formatPercentShort(shareOfEvaluationTime * 100)}
        </Text>
      </TriggerWrap>
      <RichTooltip placement="bottom">
        <Flex direction="column" gap="size-50">
          <Text size="S">{`${secondsFormatter.format(meanEvaluationSeconds)}s each · ${rateFormatter.format(evaluationsPerMinute)}/min`}</Text>
          <Text size="S" color="text-700">
            Share of the time all evaluators, in every project, spent evaluating
            over the last hour
          </Text>
        </Flex>
      </RichTooltip>
    </TooltipTrigger>
  );
}

/** The evaluators table's load cell. */
export function ProjectEvaluatorLoadCell({
  evaluationLoad,
}: {
  evaluationLoad: ProjectEvaluatorEvaluationLoad;
}) {
  return (
    <ProjectEvaluatorLoad evaluationLoad={evaluationLoad} fontFamily="mono" />
  );
}
