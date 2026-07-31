import { css } from "@emotion/react";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { TooltipTrigger } from "@phoenix/components";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

import { AgentChatWidgetTooltip, OPEN_AGENT_HOTKEY } from "./AgentChatWidget";
import { PxiButton } from "./PxiButton";
import { useAssistantAgentEnabled } from "./useAssistantAgentEnabled";

// Keep the control at the nav's natural size-S row height. The wrapper keeps
// its intrinsic size when the nav gets tight; the breadcrumb is the nav's
// designated shrinking region (see topNavCSS in Navbar.tsx).
const buttonWrapperCSS = css`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/**
 * The PXI assistant button pinned to the far right of the top nav.
 *
 * It always remains in the nav flow. The layout reserves space for non-modal
 * drawers, while modal overlays cover it with the rest of the application
 * chrome. The button is never moved into overlay content or ahead of the
 * breadcrumb.
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
  useEffect(() => {
    return agentStore.subscribe((state, previousState) => {
      if (state.isOpen === previousState.isOpen) {
        return;
      }
      const didCloseDetachedPanel =
        previousState.isOpen && !state.isOpen && state.position === "detached";
      // While a response is pending the button shows the thinking treatment,
      // whose infinite animations override the flash animations in CSS — the
      // flash would never play and never fire animationend, leaving it armed
      // until the response settles. The thinking treatment already marks the
      // button, so skip arming. The reverse race (a response becoming pending
      // while armed) cannot occur: sends require the open panel, and opening
      // disarms here.
      const isActiveResponsePending =
        state.activeSessionId != null &&
        (state.isResponsePendingBySessionId[state.activeSessionId] ?? false);
      const prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setShouldFlashOnReturnHome(
        didCloseDetachedPanel &&
          !isActiveResponsePending &&
          !prefersReducedMotion
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

  return (
    <div css={buttonWrapperCSS}>
      <TooltipTrigger delay={1000} closeDelay={0}>
        <PxiButton
          label="Ask PXI"
          size="S"
          variant="quiet"
          aria-expanded={isOpen}
          isThinking={isResponsePending}
          shouldFlash={shouldFlashOnReturnHome}
          onFlashEnd={() => setShouldFlashOnReturnHome(false)}
          onPress={() => toggleOpen()}
        />
        <AgentChatWidgetTooltip />
      </TooltipTrigger>
    </div>
  );
}
