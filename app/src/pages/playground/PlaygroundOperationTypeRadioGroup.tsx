import { ToggleButton, ToggleButtonGroup } from "@phoenix/components";
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
    <ToggleButtonGroup
      defaultSelectedKeys={[operationType]}
      aria-label="Operation Type"
      onSelectionChange={(v) => {
        if (v.size === 0) {
          return;
        }
        const type = v.keys().next().value;
        if (isGenAIOperationType(type)) {
          setOperationType(type);
        }
      }}
    >
      <ToggleButton aria-label="Chat" id={"chat"}>
        Chat
      </ToggleButton>
      <ToggleButton aria-label="Completion" id={"text_completion"}>
        Completion
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
