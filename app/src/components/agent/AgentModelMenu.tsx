import {
  ModelMenu,
  type ModelMenuProps,
} from "@phoenix/components/generative/ModelMenu";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

export function AgentModelMenu(props: Omit<ModelMenuProps, "isDisabled">) {
  const isDisabled = useAgentContext((state) =>
    Object.values(state.chatStatusBySessionId).some(
      (status) => status === "submitted" || status === "streaming"
    )
  );

  return <ModelMenu {...props} isDisabled={isDisabled} />;
}
