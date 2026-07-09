import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useHotkeys } from "react-hotkeys-hook";

import { TooltipTrigger } from "@phoenix/components";
import {
  MODAL_FLOATING_UI_Z_INDEX,
  NON_MODAL_FLOATING_Z_INDEX,
} from "@phoenix/components/core/zIndex";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import {
  useActiveDrawerElement,
  useActiveModalPortalContainerElement,
} from "@phoenix/hooks/useHasOpenModal";

import {
  AgentChatWidgetButton,
  AgentChatWidgetTooltip,
  OPEN_AGENT_HOTKEY,
} from "./AgentChatWidget";
import { useAssistantAgentEnabled } from "./useAssistantAgentEnabled";

// Keep these in sync with topNavCSS in components/nav/Navbar.tsx: the nav has
// `padding: static-size-100` (8px) and `padding-right: static-size-200`
// (16px), so the detached pill rendered at these fixed offsets appears to
// stay exactly where the in-flow pill was. The detached wrapper contains the
// same fixed-height pill wrapper as the in-flow pill, so aligning it with the
// nav's top padding reproduces the in-flow position exactly.
const NAV_PILL_TOP_PX = 8;
const NAV_PILL_RIGHT_PX = 16;
// Gap between the pill and an open drawer's left edge.
const DRAWER_EDGE_GAP_PX = 12;
// Keep at least this much room at the left viewport edge so an extremely wide
// drawer cannot push the pill off screen.
const MIN_VIEWPORT_RIGHT_GAP_PX = 96;

// Height of the nav's natural content row (a size-S control is 30px), NOT the
// pill's rendered height. The resting pill (36px, see FAB_RESTING_SIZE in
// agentFabPositioning.ts) and the streaming state (40px,
// FAB_STREAMING_SIZE.height) are both taller; pinning the wrapper to the
// nav's natural content height with visible overflow lets the pill bleed
// into the nav's 8px vertical padding without inflating the nav row —
// toggling the pill in and out of the nav must not shift the layout.
const NAV_PILL_WRAPPER_HEIGHT_PX = 30;

// Fixed-height, centered wrapper so neither the pill's resting size nor its
// height animation (resting 36px <-> streaming 40px) changes the wrapper's
// box and reflows the surrounding layout. The wrapper keeps its intrinsic
// size when the nav gets tight; the breadcrumb is the nav's designated
// shrinking region (see topNavCSS in Navbar.tsx).
const pillWrapperCSS = css`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${NAV_PILL_WRAPPER_HEIGHT_PX}px;
  overflow: visible;
`;

const detachedPillCSS = css`
  position: fixed;
  top: ${NAV_PILL_TOP_PX}px;
  z-index: ${NON_MODAL_FLOATING_Z_INDEX};
  &[data-layer="modal"] {
    z-index: ${MODAL_FLOATING_UI_Z_INDEX};
  }
  &[data-animate="true"] {
    transition: right 300ms cubic-bezier(0.2, 0.9, 0.2, 1);
  }
`;

type DrawerPillPosition = {
  rightPx: number;
  /**
   * Animate only the initial travel to the drawer's edge. Subsequent updates
   * come from the user dragging the drawer's resize handle and must track the
   * pointer without a trailing transition.
   */
  animate: boolean;
};

/**
 * Fixed-position wrapper that keeps its children just outside an open
 * drawer's left edge, tracking drawer resizes. Mount only while a drawer is
 * open; position state resets when it unmounts.
 */
function DrawerAnchoredPill({
  drawer,
  children,
}: {
  drawer: HTMLElement;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<DrawerPillPosition | null>(null);

  useEffect(() => {
    let isFirstUpdate = true;
    const update = (animate: boolean) => {
      // offsetWidth ignores the drawer's slide-in transform, so the first
      // update resolves directly to the drawer's resting edge and the CSS
      // transition covers the travel.
      const rightPx = Math.min(
        drawer.offsetWidth + DRAWER_EDGE_GAP_PX,
        window.innerWidth - MIN_VIEWPORT_RIGHT_GAP_PX
      );
      setPosition({ rightPx, animate });
    };
    // The observer fires once on observe, which handles initial positioning.
    const observer = new ResizeObserver(() => {
      update(isFirstUpdate);
      isFirstUpdate = false;
    });
    observer.observe(drawer);
    const handleViewportResize = () => update(false);
    window.addEventListener("resize", handleViewportResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleViewportResize);
    };
  }, [drawer]);

  return createPortal(
    <div
      css={detachedPillCSS}
      style={{ right: position?.rightPx ?? NAV_PILL_RIGHT_PX }}
      data-animate={(position?.animate ?? true) ? "true" : "false"}
    >
      {children}
    </div>,
    document.body
  );
}

/**
 * The PXI assistant button pinned to the far right of the top nav.
 *
 * Renders inline in the nav flow so it never overlaps page content. Because
 * drawers (slideovers) are fixed to the right viewport edge and cover the top
 * nav's right side, the pill detaches while one is open and slides left to
 * rest just outside the drawer's edge, tracking drawer resizes. While a modal
 * is open it portals into the modal layer so it stays interactive above the
 * backdrop.
 */
export function AgentChatTopNavButton() {
  const isAssistantAgentEnabled = useAssistantAgentEnabled();
  const isOpen = useAgentContext((state) => state.isOpen);
  const toggleOpen = useAgentContext((state) => state.toggleOpen);
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const isStreaming = useAgentContext((state) =>
    activeSessionId
      ? state.chatStatusBySessionId[activeSessionId] === "streaming"
      : false
  );
  const drawer = useActiveDrawerElement();
  const modalContainer = useActiveModalPortalContainerElement();

  useHotkeys(
    OPEN_AGENT_HOTKEY,
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleOpen();
    },
    {
      enabled: isAssistantAgentEnabled,
      preventDefault: true,
    },
    [isAssistantAgentEnabled, toggleOpen]
  );

  if (!isAssistantAgentEnabled) {
    return null;
  }

  const button = (
    <div css={pillWrapperCSS}>
      <TooltipTrigger delay={1000} closeDelay={0}>
        <AgentChatWidgetButton
          ariaLabel="Open assistant"
          aria-expanded={isOpen}
          isStreaming={isStreaming}
          onPress={() => toggleOpen()}
        />
        <AgentChatWidgetTooltip />
      </TooltipTrigger>
    </div>
  );

  // Modals cover the whole viewport with a backdrop; portal into the modal
  // layer (like the floating FAB does) so the pill stays interactive.
  if (modalContainer) {
    return createPortal(
      <div
        css={detachedPillCSS}
        style={{ right: NAV_PILL_RIGHT_PX }}
        data-layer="modal"
      >
        {button}
      </div>,
      modalContainer
    );
  }

  if (drawer) {
    return <DrawerAnchoredPill drawer={drawer}>{button}</DrawerAnchoredPill>;
  }

  return button;
}
