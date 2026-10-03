import { PxiFrameBorder } from "./PxiFrameBorder";
import { useAssistantAgentEnabled } from "./useAssistantAgentEnabled";
import { usePxiFrameBorderState } from "./usePxiFrameBorderState";

function ConnectedPxiFrameBorder() {
  const state = usePxiFrameBorderState();
  return <PxiFrameBorder state={state} />;
}

export function PxiFrameBorderMount() {
  const isAgentAssistantEnabled = useAssistantAgentEnabled();
  return isAgentAssistantEnabled ? <ConnectedPxiFrameBorder /> : null;
}
