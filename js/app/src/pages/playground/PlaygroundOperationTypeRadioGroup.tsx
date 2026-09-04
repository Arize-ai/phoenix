import { SegmentedControl, SegmentedControlItem } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { GenAIOperationType } from "@phoenix/store";

function isGenAIOperationType(v: string): v is GenAIOperationType {
  return v === "chat" || v === "text_completion";
}

export function PlaygroundOperationTypeRadioGroup() {
  const operationType = usePlaygroundContext((state) => state.operationType);
  const setOperationType = usePlaygroundContext(
    (state) => state.setOperationType
  );
  return (
    <SegmentedControl
      selectedKey={operationType}
      aria-label="Operation Type"
      onSelectionChange={(type) => {
        if (typeof type === "string" && isGenAIOperationType(type)) {
          setOperationType(type);
        }
      }}
    >
      <SegmentedControlItem aria-label="Chat" id="chat">
        Chat
      </SegmentedControlItem>
      <SegmentedControlItem aria-label="Completion" id="text_completion">
        Completion
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
