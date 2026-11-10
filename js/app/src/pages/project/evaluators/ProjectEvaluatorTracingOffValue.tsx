import type { TextProps } from "@phoenix/components";
import {
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";

/**
 * Stands in for a value measured from an evaluator's traces while its
 * tracing is off, saying why on hover.
 */
export function ProjectEvaluatorTracingOffValue({
  measure,
  size,
  fontFamily,
}: {
  /** What is measured from traces, as it opens a sentence: "Evaluation time". */
  measure: string;
} & Pick<TextProps, "size" | "fontFamily">) {
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <Text size={size} fontFamily={fontFamily} color="text-700">
          tracing off
        </Text>
      </TriggerWrap>
      <RichTooltip placement="bottom">
        <Text size="S">
          {`${measure} is measured from traces, and this evaluator's tracing is off.`}
        </Text>
      </RichTooltip>
    </TooltipTrigger>
  );
}
