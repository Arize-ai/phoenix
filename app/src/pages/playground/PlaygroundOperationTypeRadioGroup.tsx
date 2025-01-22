import React from "react";

import { Radio, RadioGroup } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { GenAIOperationType } from "@phoenix/store";

function isGenAIOperationType(v: string): v is GenAIOperationType {
  return v === "chat" || v === "text_completion";
}

export function PlaygroundOperationTypeRadioGroup() {
  const operationType = usePlaygroundContext((state) => state.operationType);
  const setOperationType = usePlaygroundContext(
    (state) => state.setOperationType
  );
  return (
    <RadioGroup
      value={operationType}
      aria-label="Operation Type"
      onChange={(v) => {
        if (isGenAIOperationType(v)) {
          setOperationType(v);
        }
      }}
    >
      <Radio aria-label="Chat" value={"chat"}>
        Chat
      </Radio>
      <Radio aria-label="Completion" value={"text_completion"}>
        Completion
      </Radio>
    </RadioGroup>
  );
}
