import React from "react";

import { Radio, RadioGroup } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { InvocationMode } from "@phoenix/store";

function isInvocationMode(v: string): v is InvocationMode {
  return v === "chat" || v === "Completion";
}

export function PlaygroundModeRadioGroup() {
  const mode = usePlaygroundContext((state) => state.invocationMode);
  const setMode = usePlaygroundContext((state) => state.setInvocationMode);
  return (
    <RadioGroup
      value={mode}
      variant="inline-button"
      onChange={(v) => {
        if (isInvocationMode(v)) {
          setMode(v);
        }
      }}
    >
      <Radio label="Chat" value={"chat"}>
        Chat
      </Radio>
      <Radio label="Completion" value={"Completion"}>
        Completion
      </Radio>
    </RadioGroup>
  );
}
