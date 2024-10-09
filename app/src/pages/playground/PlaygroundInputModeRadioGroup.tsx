import React from "react";

import { Radio, RadioGroup } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

/**
 * A store connected radio group that toggles between manual and dataset input types.
 */
export function PlaygroundInputTypeTypeRadioGroup() {
  const inputMode = usePlaygroundContext((state) => state.inputMode);
  const setInputMode = usePlaygroundContext((state) => state.setInputMode);
  return (
    <RadioGroup
      value={inputMode}
      variant="inline-button"
      size="compact"
      onChange={(value) => {
        if (value === "manual" || value === "dataset") {
          setInputMode(value);
        }
      }}
    >
      <Radio label="manual" value={"manual"}>
        Manual
      </Radio>
      <Radio label="Dataset" value={"dataset"}>
        Dataset
      </Radio>
    </RadioGroup>
  );
}
