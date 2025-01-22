import React from "react";
import { css } from "@emotion/react";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Icon, Icons, Radio, RadioGroup } from "@phoenix/components";
import { CanvasMode } from "@phoenix/store";

const radioItemCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-static-size-50);
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
    <RadioGroup
      defaultValue={props.mode}
      aria-label="Canvas Mode"
      onChange={(v) => {
        if (isCanvasMode(v)) {
          props.onChange(v);
        } else {
          throw new Error(`Unknown canvas mode: ${v}`);
        }
      }}
    >
      <Radio aria-label="Move" value={CanvasMode.move}>
        <TooltipTrigger placement="top" delay={0} offset={10}>
          <TriggerWrap>
            <div css={radioItemCSS}>
              <Icon svg={<Icons.MoveFilled />} /> Move
            </div>
          </TriggerWrap>
          <Tooltip>Move around the canvas using orbital controls</Tooltip>
        </TooltipTrigger>
      </Radio>
      <Radio aria-label="Select" value={CanvasMode.select}>
        <TooltipTrigger placement="top" delay={0} offset={10}>
          <TriggerWrap>
            <div css={radioItemCSS}>
              <Icon svg={<Icons.LassoOutline />} /> Select
            </div>
          </TriggerWrap>
          <Tooltip>Select points using the lasso tool</Tooltip>
        </TooltipTrigger>
      </Radio>
    </RadioGroup>
  );
}
