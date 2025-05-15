import { css } from "@emotion/react";

import { Tooltip, TooltipTrigger } from "@arizeai/components";

import {
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";
import { CanvasMode } from "@phoenix/store";

const radioItemCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-static-size-50);
  align-items: center;
`;
/**
 * TypeGuard for the canvas mode
 */
function isCanvasMode(m: unknown): m is CanvasMode {
  return typeof m === "string" && m in CanvasMode;
}

type CanvasModeRadioGroupProps = {
  mode: CanvasMode;
  onChange: (mode: CanvasMode) => void;
};

export function CanvasModeRadioGroup(props: CanvasModeRadioGroupProps) {
  return (
    <ToggleButtonGroup
      selectedKeys={[props.mode]}
      aria-label="Canvas Mode"
      size="S"
      onSelectionChange={(v) => {
        if (v.size === 0) {
          return;
        }
        const mode = v.keys().next().value;
        if (isCanvasMode(mode)) {
          props.onChange(mode);
        } else {
          throw new Error(`Unknown canvas mode: ${v}`);
        }
      }}
    >
      <TooltipTrigger placement="top" delay={0} offset={10}>
        <ToggleButton aria-label="Move" id={CanvasMode.move}>
          <div css={radioItemCSS}>
            <Icon svg={<Icons.MoveFilled />} /> Move
          </div>
        </ToggleButton>
        <Tooltip>Move around the canvas using orbital controls</Tooltip>
      </TooltipTrigger>
      <TooltipTrigger placement="top" delay={0} offset={10}>
        <ToggleButton aria-label="Select" id={CanvasMode.select}>
          <div css={radioItemCSS}>
            <Icon svg={<Icons.LassoOutline />} /> Select
          </div>
        </ToggleButton>
        <Tooltip>Select points using the lasso tool</Tooltip>
      </TooltipTrigger>
    </ToggleButtonGroup>
  );
}
