import React from "react";
import { css } from "@emotion/react";

import { Icon, Icons, Radio, RadioGroup } from "@arizeai/components";

export enum CanvasMode {
  move = "move",
  select = "select",
}

const radioItemCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--px-spacing-sm);
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
      variant="inline-button"
      size="compact"
      onChange={(v) => {
        if (isCanvasMode(v)) {
          props.onChange(v);
        } else {
          throw new Error(`Unknown canvas mode: ${v}`);
        }
      }}
    >
      <Radio label="Move" value={CanvasMode.move}>
        <div css={radioItemCSS}>
          <Icon svg={<Icons.MoveFilled />} /> Move
        </div>
      </Radio>
      <Radio label="Select" value={CanvasMode.select}>
        <div css={radioItemCSS}>
          <Icon svg={<Icons.LassoOutline />} /> Select
        </div>
      </Radio>
    </RadioGroup>
  );
}
