import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Icon,
  Icons,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { formatEvaluationTargetPlural } from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { assertUnreachable } from "@phoenix/typeUtils";

export function getProjectEvaluatorTargetIconSvg(
  target: ProjectEvaluatorTarget
): ReactNode {
  switch (target) {
    case "SPAN":
      return <Icons.Span />;
    case "TRACE":
      return <Icons.Trace />;
    case "SESSION":
      return <Icons.MessagesSquare />;
    default:
      return assertUnreachable(target);
  }
}

const targetIconCSS = css`
  color: var(--global-text-color-700);
`;

/** The target's icon, with a tooltip naming what the evaluator runs on. */
export function ProjectEvaluatorTargetIcon({
  target,
}: {
  target: ProjectEvaluatorTarget;
}) {
  const label = `Evaluates ${formatEvaluationTargetPlural(target)}`;
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap aria-label={label}>
        <Icon
          svg={getProjectEvaluatorTargetIconSvg(target)}
          css={targetIconCSS}
        />
      </TriggerWrap>
      <Tooltip offset={4}>
        <TooltipArrow />
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
}
