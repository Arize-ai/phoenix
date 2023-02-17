import { Icon, Icons, Radio, RadioGroup } from "@arizeai/components";
import React from "react";

export enum CanvasMode {
  move = "move",
  select = "select",
}

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
        <Icon svg={<Icons.MoveFilled />} />
      </Radio>
      <Radio label="Select" value={CanvasMode.select}>
        <Icon svg={<Icons.LassoOutline />} />
      </Radio>
    </RadioGroup>
  );
}
