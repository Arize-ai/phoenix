import { useState, type ReactNode, type RefObject } from "react";

import { useAgentContext } from "@phoenix/contexts/AgentContext";
import type { AgentPosition } from "@phoenix/store/agentStore";

import {
  DEFAULT_FLOATING_AGENT_CHAT_SIZE,
  DockedAgentChatFrame,
  FloatingAgentChatFrame,
} from "./AgentChatPanelView";
import { AgentSessionsResource } from "./AgentSessionsResource";
import { useAgentChatPanelState } from "./useAgentChatPanelState";
import { useAssistantAgentEnabled } from "./useAssistantAgentEnabled";

type AgentChatPanelLayer = "content" | "modal";

type FloatingAgentChatPanelProps = {
  /**
   * Optional element that scopes the panel's default position and clamping.
   * When omitted, the panel falls back to the visual viewport.
   */
  boundaryRef?: RefObject<HTMLElement | null>;
  /**
   * Controls which stacking and interaction layer owns the floating panel.
   *
   * - `content` is the normal floating assistant surface rendered over page
   *   content. It reflects the user's persisted pinned/detached preference and
   *   may expose controls that change that preference.
   * - `modal` is a temporary modal-scoped surface used while a modal or
   *   slideover is active. It portals into the active modal's portal container
   *   so React Aria keeps the assistant interactive instead of marking it inert.
   */
  layer?: AgentChatPanelLayer;
  /**
   * Whether an active overlay is temporarily forcing the assistant into the
   * floating layout regardless of the user's saved panel preference.
   */
  isForcedFloating?: boolean;
};

type AgentChatSurfaceProps = {
  renderFrame: (children: ReactNode) => ReactNode;
  /**
   * Visible panel position to show in the header when the rendered surface is
   * temporarily different from the user's saved preference.
   */
  positionOverride?: AgentPosition;
  /**
   * Whether the header position toggle should be disabled because the visible
   * layout is controlled by another surface, such as a modal or drawer.
   */
  isPositionChangeDisabled?: boolean;
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
 *
 * The `modal` layer is used only as an accessibility escape hatch while an
 * overlay is active. It keeps the assistant above the modal mask and inside the
 * modal's interaction scope without mutating the user's normal pinned/detached
 * setting.
 */
export function FloatingAgentChatPanel({
  boundaryRef,
  layer = "content",
  isForcedFloating = false,
}: FloatingAgentChatPanelProps) {
  const fabPlacement = useAgentContext((state) => state.fabPlacement);
  const [panelSize, setPanelSize] = useState(DEFAULT_FLOATING_AGENT_CHAT_SIZE);

  return (
    <AgentChatSurface
      isPositionChangeDisabled={isForcedFloating}
      positionOverride={isForcedFloating ? "detached" : undefined}
      renderFrame={(children) => (
        <FloatingAgentChatFrame
          boundaryRef={boundaryRef}
          layer={layer}
          placement={fabPlacement}
          size={panelSize}
          onSizeChange={setPanelSize}
          isForcedFloating={isForcedFloating}
        >
          {children}
        </FloatingAgentChatFrame>
      )}
    />
  );
}

function AgentChatSurface({
  renderFrame,
  positionOverride,
  isPositionChangeDisabled = false,
}: AgentChatSurfaceProps) {
  const isAgentAssistantEnabled = useAssistantAgentEnabled();
  const { isOpen, position } = useAgentChatPanelState();

  if (!isAgentAssistantEnabled || !isOpen) {
    return null;
  }

  return renderFrame(
    <AgentSessionsResource
      position={positionOverride ?? position}
      isPositionChangeDisabled={isPositionChangeDisabled}
    />
  );
}
