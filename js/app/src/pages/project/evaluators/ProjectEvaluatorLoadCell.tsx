import type { TextProps } from "@phoenix/components";
import {
  Flex,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { ProjectEvaluatorTracingOffValue } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTracingOffValue";
import {
  formatPercentShort,
  intFormatter,
} from "@phoenix/utils/numberFormatUtils";

export type ProjectEvaluatorEvaluationLoad = {
  evaluationCount: number;
  meanEvaluationSeconds: number | null;
  shareOfEvaluationTime: number | null;
  /** False while the evaluator's tracing is off: load is measured from traces. */
  isMeasured: boolean;
  /** Whether the server total leaves out an enabled evaluator with tracing off. */
  excludesUntracedEvaluators: boolean;
};

const secondsFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

/**
 * The share of the server's evaluation time this evaluator used over the last
 * hour, with its evaluation count and mean time on hover. Shown as `--` before
 * it has evaluated anything in that hour, and as "tracing off" when its load
 * is not measured. When other evaluators' load is not measured, the hover
 * says the share leaves them out.
 */
export function ProjectEvaluatorLoad({
  evaluationLoad,
  size,
  fontFamily,
}: {
  evaluationLoad: ProjectEvaluatorEvaluationLoad;
} & Pick<TextProps, "size" | "fontFamily">) {
  const {
    evaluationCount,
    meanEvaluationSeconds,
    shareOfEvaluationTime,
    isMeasured,
    excludesUntracedEvaluators,
  } = evaluationLoad;
  if (!isMeasured) {
    return (
      <ProjectEvaluatorTracingOffValue
        measure="Evaluation time"
        size={size}
        fontFamily={fontFamily}
      />
    );
  }
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
          <Text size="S">{`${formatPercentShort(shareOfEvaluationTime * 100)} of all evaluation time in the last hour`}</Text>
          <Text size="S">
            {evaluationCount === 1
              ? `1 evaluation, ${secondsFormatter.format(meanEvaluationSeconds)}s`
              : `${intFormatter(evaluationCount)} evaluations, ${secondsFormatter.format(meanEvaluationSeconds)}s each`}
          </Text>
          {excludesUntracedEvaluators ? (
            <Text size="S" color="text-700">
              Excludes evaluators with tracing off, whose evaluation time is not
              measured.
            </Text>
          ) : null}
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
