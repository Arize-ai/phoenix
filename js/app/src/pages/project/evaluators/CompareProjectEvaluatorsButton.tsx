import { css } from "@emotion/react";

import {
  Icon,
  Icons,
  LinkButton,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import {
  getCompareEvaluatorsDisabledReason,
  type ProjectEvaluatorSelection,
} from "@phoenix/pages/project/evaluators/projectEvaluatorSelection";

/**
 * Links to the comparison of the two selected evaluators. Rendered as a real
 * link so it can be opened in a new tab; when the selection cannot be
 * compared the link is disabled and a tooltip explains why.
 */
export function CompareProjectEvaluatorsButton({
  selection,
}: {
  selection: ProjectEvaluatorSelection;
}) {
  const paths = useProjectEvaluatorPaths();
  const disabledReason = getCompareEvaluatorsDisabledReason(selection);
  const [evaluatorAId, evaluatorBId] = Object.keys(selection);
  const isComparable =
    disabledReason == null && evaluatorAId != null && evaluatorBId != null;
  const link = (
    <LinkButton
      size="M"
      variant="primary"
      isDisabled={!isComparable}
      leadingVisual={<Icon svg={<Icons.ArrowCompare />} />}
      to={
        isComparable ? paths.compare({ a: evaluatorAId, b: evaluatorBId }) : "."
      }
    >
      Compare
    </LinkButton>
  );

  if (isComparable) {
    return link;
  }
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap
        css={css`
          a {
            pointer-events: none;
          }
        `}
      >
        {link}
      </TriggerWrap>
      <Tooltip>
        <TooltipArrow />
        <Text size="XS">{disabledReason}</Text>
      </Tooltip>
    </TooltipTrigger>
  );
}
