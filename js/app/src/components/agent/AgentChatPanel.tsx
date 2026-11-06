import { useState, type ReactNode, type RefObject } from "react";

import { useAgentContext } from "@phoenix/contexts/AgentContext";

import {
  DEFAULT_FLOATING_AGENT_CHAT_SIZE,
  DockedAgentChatFrame,
  FloatingAgentChatFrame,
} from "./AgentChatPanelView";
import { AgentSessionsResource } from "./AgentSessionsResource";
import { useAgentChatPanelState } from "./useAgentChatPanelState";
import { useAssistantAgentEnabled } from "./useAssistantAgentEnabled";

type FloatingAgentChatPanelProps = {
  /**
   * Optional element that scopes the panel's default position and clamping.
   * When omitted, the panel falls back to the visual viewport.
   */
  boundaryRef?: RefObject<HTMLElement | null>;
};

type AgentChatSurfaceProps = {
  renderFrame: (children: ReactNode) => ReactNode;
};

/**
 * Controller for the pinned side-panel agent chat.
 */
export function AgentChatPanel() {
  return (
    <AgentChatSurface
      renderFrame={(children) => (
        <DockedAgentChatFrame>{children}</DockedAgentChatFrame>
      )}
    />
  );
}

/**
 * Controller for the assistant's floating chat surface.
 */
export function FloatingAgentChatPanel({
  boundaryRef,
}: FloatingAgentChatPanelProps) {
  const fabPlacement = useAgentContext((state) => state.fabPlacement);
  const [panelSize, setPanelSize] = useState(DEFAULT_FLOATING_AGENT_CHAT_SIZE);

  return (
    <AgentChatSurface
      renderFrame={(children) => (
        <FloatingAgentChatFrame
          boundaryRef={boundaryRef}
          placement={fabPlacement}
          size={panelSize}
          onSizeChange={setPanelSize}
        >
          {children}
        </FloatingAgentChatFrame>
      )}
    />
  );
}

function AgentChatSurface({ renderFrame }: AgentChatSurfaceProps) {
  const isAgentAssistantEnabled = useAssistantAgentEnabled();
  const { isOpen, position } = useAgentChatPanelState();

  if (!isAgentAssistantEnabled || !isOpen) {
    return null;
  }
  return renderFrame(<AgentSessionsResource position={position} />);
}
