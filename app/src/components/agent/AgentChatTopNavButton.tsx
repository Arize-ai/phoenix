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
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import {
  useActiveDrawerElement,
  useActiveModalPortalContainerElement,
} from "@phoenix/hooks/useHasOpenModal";

import { AgentChatWidgetTooltip, OPEN_AGENT_HOTKEY } from "./AgentChatWidget";
import { PxiButton } from "./PxiButton";
import { useAssistantAgentEnabled } from "./useAssistantAgentEnabled";

// Gap between the button and an open drawer's left edge.
const DRAWER_EDGE_GAP_PX = 12;
// Keep at least this much room at the left viewport edge so an extremely wide
// drawer cannot push the button off screen.
const MIN_VIEWPORT_RIGHT_GAP_PX = 96;

// Keep the control at the nav's natural size-S row height. The wrapper keeps
// its intrinsic size when the nav gets tight; the breadcrumb is the nav's
// designated shrinking region (see topNavCSS in Navbar.tsx).
const buttonWrapperCSS = css`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const detachedButtonCSS = css`
  position: fixed;
  top: var(--global-dimension-static-size-100);
  right: var(--global-dimension-static-size-200);
  z-index: ${NON_MODAL_FLOATING_Z_INDEX};
  &[data-layer="modal"] {
    z-index: ${MODAL_FLOATING_UI_Z_INDEX};
  }
  &[data-animate="true"] {
    transition: right 300ms cubic-bezier(0.2, 0.9, 0.2, 1);
  }
`;

type DrawerButtonPosition = {
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
function DrawerAnchoredButton({
  drawer,
  children,
}: {
  drawer: HTMLElement;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<DrawerButtonPosition | null>(null);

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
      css={detachedButtonCSS}
      style={{ right: position?.rightPx }}
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
 * nav's right side, the button detaches while one is open and slides left to
 * rest just outside the drawer's edge, tracking drawer resizes. While a modal
 * is open it portals into the modal layer so it stays interactive above the
 * backdrop.
 */
export function AgentChatTopNavButton() {
  const isAssistantAgentEnabled = useAssistantAgentEnabled();
  const agentStore = useAgentStore();
  const isOpen = useAgentContext((state) => state.isOpen);
  const position = useAgentContext((state) => state.position);
  const toggleOpen = useAgentContext((state) => state.toggleOpen);
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const [shouldFlashOnReturnHome, setShouldFlashOnReturnHome] = useState(false);
  const isResponsePending = useAgentContext((state) =>
    activeSessionId
      ? (state.isResponsePendingBySessionId[activeSessionId] ?? false)
      : false
  );
  const drawer = useActiveDrawerElement();
  const modalContainer = useActiveModalPortalContainerElement();

  useEffect(() => {
    return agentStore.subscribe((state, previousState) => {
      if (state.isOpen === previousState.isOpen) {
        return;
      }
      const didCloseDetachedPanel =
        previousState.isOpen && !state.isOpen && state.position === "detached";
      const prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setShouldFlashOnReturnHome(
        didCloseDetachedPanel && !prefersReducedMotion
      );
    });
  }, [agentStore]);

  useHotkeys(
    OPEN_AGENT_HOTKEY,
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleOpen();
    },
    {
      enabled: isAssistantAgentEnabled,
      // Keep the hotkey live while focus is inside the agent chat's textarea
      // (or any form field) so pressing the shortcut again toggles the panel
      // closed rather than being swallowed by the focused input.
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [isAssistantAgentEnabled, toggleOpen]
  );

  const shouldHideForOpenPinnedPanel = isOpen && position === "pinned";
  if (!isAssistantAgentEnabled || shouldHideForOpenPinnedPanel) {
    return null;
  }

  const button = (
    <div css={buttonWrapperCSS}>
      <TooltipTrigger delay={1000} closeDelay={0}>
        <PxiButton
          label="Ask PXI"
          size="S"
          variant="quiet"
          aria-expanded={isOpen}
          isThinking={isResponsePending}
          shouldFlash={shouldFlashOnReturnHome}
          onAnimationEnd={() => setShouldFlashOnReturnHome(false)}
          onPress={() => toggleOpen()}
        />
        <AgentChatWidgetTooltip />
      </TooltipTrigger>
    </div>
  );

  // Modals cover the whole viewport with a backdrop; portal into the modal
  // layer (like the floating FAB does) so the button stays interactive.
  if (modalContainer) {
    return createPortal(
      <div css={detachedButtonCSS} data-layer="modal">
        {button}
      </div>,
      modalContainer
    );
  }

  if (drawer) {
    return (
      <DrawerAnchoredButton drawer={drawer}>{button}</DrawerAnchoredButton>
    );
  }

  return button;
}
