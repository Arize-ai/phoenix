import { css } from "@emotion/react";
import { useNavigate } from "react-router";

import {
  Button,
  Icon,
  Icons,
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

export function CompareProjectEvaluatorsButton({
  selection,
}: {
  selection: ProjectEvaluatorSelection;
}) {
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const disabledReason = getCompareEvaluatorsDisabledReason(selection);
  const selected = Object.values(selection);
  const button = (
    <Button
      size="M"
      variant="primary"
      isDisabled={disabledReason != null}
      leadingVisual={<Icon svg={<Icons.ArrowCompare />} />}
      onPress={() => {
        const [a, b] = selected;
        if (a && b) {
          navigate(paths.compare({ a: a.id, b: b.id }));
        }
      }}
    >
      Compare
    </Button>
  );

  if (disabledReason == null) {
    return button;
  }
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap
        css={css`
          .react-aria-Button {
            pointer-events: none;
          }
        `}
      >
        {button}
      </TriggerWrap>
      <Tooltip>
        <TooltipArrow />
        <Text size="XS">{disabledReason}</Text>
      </Tooltip>
    </TooltipTrigger>
  );
}
