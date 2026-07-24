import { css, keyframes } from "@emotion/react";
import { AnimatePresence, motion } from "motion/react";
import type { Ref, RefObject } from "react";
import type { ButtonProps as AriaButtonProps } from "react-aria-components";
import { Button as AriaButton } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";

import {
  Flex,
  Keyboard,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  VisuallyHidden,
} from "@phoenix/components";
import { useTheme } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";

import { AgentFabPositioner } from "./AgentFabPositioner";
import { FAB_RESTING_SIZE, FAB_STREAMING_SIZE } from "./agentFabPositioning";
import { PxiGlyph, type PxiGlyphAnimation } from "./PxiGlyph";
import {
  pxiGlowBreathe,
  pxiGlowFlashOpacity,
  pxiGlowWipe,
  pxiGlowWipeMaskCSS,
  pxiThinkingGlowWipe,
} from "./pxiStyles";
import { useAssistantAgentEnabled } from "./useAssistantAgentEnabled";

export const OPEN_AGENT_HOTKEY = "mod+i";

const glyphBreathe = keyframes`
  0%, 100% {
    color: var(--agent-chat-widget-glyph-rest-color);
    filter: drop-shadow(0 0 0 var(--agent-chat-widget-glyph-pulse-shadow));
  }

  50% {
    color: var(--agent-chat-widget-glyph-pulse-color);
    filter: drop-shadow(0 0 3px var(--agent-chat-widget-glyph-pulse-shadow));
  }
`;

const buttonCSS = css`
  border: none;
  cursor: pointer;
  background: transparent;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const inlineButtonCSS = css`
  position: relative;
`;

// Applied when the button is used as a drag handle inside the FAB positioner.
// The positioner owns the cursor (pointer / grabbing) and consumes touch
// gestures itself, so the button only needs to opt out of both.
const draggableButtonCSS = css`
  cursor: inherit;
  touch-action: none;
`;

const darkThemeGlyphThemeCSS = css`
  &[data-theme="dark"] {
    --agent-chat-widget-glyph-rest-color: #1f2730;
    --agent-chat-widget-glyph-pulse-color: #6b7c8f;
    --agent-chat-widget-glyph-pulse-shadow: rgba(107, 124, 143, 0.4);
  }
`;

const lightThemeGlyphThemeCSS = css`
  &[data-theme="light"] {
    --agent-chat-widget-glyph-rest-color: var(--global-color-gray-50);
    --agent-chat-widget-glyph-pulse-color: #a4a9ae;
    --agent-chat-widget-glyph-pulse-shadow: rgba(156, 205, 255, 0.4);
  }
`;

const shapeCSS = css`
  --pxi-glow-box-shadow-rest: var(--pxi-glow-box-shadow-fab-rest);
  --pxi-glow-box-shadow-strong: var(--pxi-glow-box-shadow-fab-strong);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--global-color-gray-900);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  color: var(--agent-chat-widget-glyph-rest-color);
  font-size: var(--global-font-size-s);
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0.02em;
  gap: 4px;
  overflow: visible;
  isolation: isolate;

  .fab-glyph {
    overflow: visible;
    flex-shrink: 0;
  }

  .fab-glyph circle,
  .fab-glyph rect {
    fill: currentColor;
    transition: fill 160ms ease-out;
  }

  .agent-chat-widget__indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    isolation: isolate;
    flex-shrink: 0;
  }
`;

const shapeContentCSS = css`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: inherit;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  overflow: hidden;
  color: inherit;
  transition:
    color 160ms ease-out,
    filter 160ms ease-out,
    opacity 160ms ease-out;
  will-change: color, filter, opacity;
`;

const thinkingBorderCSS = css`
  .agent-chat-widget__shimmer {
    ${pxiGlowWipeMaskCSS};
    position: absolute;
    inset: calc(-1 * var(--pxi-glow-bleed));
    z-index: 0;
    border-radius: inherit;
    mix-blend-mode: plus-lighter;
    pointer-events: none;
    opacity: 1;
    -webkit-mask-position: center;
    mask-position: center;
    /* Preserve the original 200% / 3000ms velocity across the full 240% path. */
    animation: ${pxiThinkingGlowWipe} 3600ms linear infinite both -0.5s;
  }

  .agent-chat-widget__shimmer::before {
    content: "";
    position: absolute;
    inset: var(--pxi-glow-bleed);
    border-radius: inherit;
    opacity: 1;
  }

  .agent-chat-widget__shimmer::before {
    box-shadow: var(--pxi-glow-box-shadow-rest);
    animation: ${pxiGlowBreathe} var(--pxi-glow-wipe-duration) ease-in-out
      infinite;
    z-index: -1;
  }
`;

const restingHoverWipeCSS = css`
  .agent-chat-widget__content {
    opacity: 0.9;
  }

  .agent-chat-widget__hover-shimmer {
    ${pxiGlowWipeMaskCSS};
    position: absolute;
    inset: calc(-1 * var(--pxi-glow-bleed));
    z-index: 0;
    border-radius: inherit;
    mix-blend-mode: plus-lighter;
    pointer-events: none;
  }

  .agent-chat-widget__hover-shimmer::before {
    content: "";
    position: absolute;
    inset: var(--pxi-glow-bleed);
    border-radius: inherit;
    box-shadow: var(--pxi-glow-box-shadow-rest);
    opacity: 0;
    transition:
      opacity 240ms ease-out,
      box-shadow 240ms ease-out;
  }

  &:hover .agent-chat-widget__hover-shimmer {
    animation: ${pxiGlowWipe} var(--pxi-glow-wipe-duration)
      var(--pxi-glow-wipe-easing) infinite;
  }

  &:hover .agent-chat-widget__hover-shimmer::before {
    opacity: var(--pxi-glow-opacity);
    animation: ${pxiGlowBreathe} var(--pxi-glow-wipe-duration) ease-in-out 1
      both;
  }

  &:hover .agent-chat-widget__content {
    opacity: 1;
  }
`;

const entranceHoverWipeCSS = css`
  @media (prefers-reduced-motion: no-preference) {
    &[data-entrance-animation="true"] .agent-chat-widget__hover-shimmer {
      animation: ${pxiGlowWipe} var(--pxi-glow-wipe-duration)
        var(--pxi-glow-wipe-easing) 1;
    }

    &[data-entrance-animation="true"]
      .agent-chat-widget__hover-shimmer::before {
      animation:
        ${pxiGlowBreathe} var(--pxi-glow-wipe-duration) ease-in-out 1,
        ${pxiGlowFlashOpacity} var(--pxi-glow-wipe-duration) linear 1;
    }

    &[data-entrance-animation="true"] .agent-chat-widget__content {
      opacity: 1;
    }

    &[data-entrance-animation="true"]:hover .agent-chat-widget__hover-shimmer {
      animation: ${pxiGlowWipe} var(--pxi-glow-wipe-duration)
        var(--pxi-glow-wipe-easing) infinite;
    }

    &[data-entrance-animation="true"]:hover
      .agent-chat-widget__hover-shimmer::before {
      opacity: var(--pxi-glow-opacity);
      animation: ${pxiGlowBreathe} var(--pxi-glow-wipe-duration) ease-in-out 1
        both;
    }
  }
`;

const thinkingGlyphPulseCSS = css`
  .agent-chat-widget__content {
    animation: ${glyphBreathe} var(--pxi-glow-wipe-duration) ease-in-out
      infinite;
  }
`;

export type { PxiGlyphAnimation } from "./PxiGlyph";

export interface AgentChatWidgetButtonProps extends Omit<
  AriaButtonProps,
  "aria-label" | "children" | "type"
> {
  ref?: Ref<HTMLButtonElement>;
  isStreaming?: boolean;
  ariaLabel?: string;
  isDragHandle?: boolean;
  glyphAnimation?: PxiGlyphAnimation;
}

export function AgentChatWidgetButton({
  ref,
  isStreaming = false,
  ariaLabel = "Open assistant",
  isDragHandle = false,
  glyphAnimation = "wave-reveal",
  ...buttonProps
}: AgentChatWidgetButtonProps) {
  const { theme } = useTheme();
  const shouldShowEntranceAnimation = !isStreaming;
  return (
    <AriaButton
      ref={ref}
      type="button"
      css={[
        buttonCSS,
        inlineButtonCSS,
        isDragHandle ? draggableButtonCSS : undefined,
      ]}
      {...buttonProps}
      aria-label={ariaLabel}
    >
      <motion.div
        css={[
          shapeCSS,
          darkThemeGlyphThemeCSS,
          lightThemeGlyphThemeCSS,
          !isStreaming ? [thinkingBorderCSS, restingHoverWipeCSS] : undefined,
          shouldShowEntranceAnimation ? entranceHoverWipeCSS : undefined,
          isStreaming ? thinkingBorderCSS : undefined,
          isStreaming ? thinkingGlyphPulseCSS : undefined,
        ]}
        data-theme={theme}
        data-entrance-animation={
          shouldShowEntranceAnimation ? "true" : undefined
        }
        initial={false}
        animate={{
          width: isStreaming ? 40 : 58,
          height: isStreaming ? 40 : 36,
          borderRadius: isStreaming ? 20 : 18,
          paddingLeft: isStreaming ? 0 : 8,
          paddingRight: isStreaming ? 0 : 8,
          paddingTop: 0,
          paddingBottom: 0,
        }}
        transition={{
          duration: 0.3,
          ease: [0.2, 0.9, 0.2, 1],
        }}
      >
        {!isStreaming ? (
          <span className="agent-chat-widget__hover-shimmer" />
        ) : null}
        {isStreaming ? <span className="agent-chat-widget__shimmer" /> : null}
        <div className="agent-chat-widget__content" css={shapeContentCSS}>
          {isStreaming ? (
            <div className="agent-chat-widget__indicator">
              <PxiGlyph
                className="fab-glyph"
                fill="currentColor"
                animation={glyphAnimation}
              />
            </div>
          ) : (
            <PxiGlyph
              className="fab-glyph"
              fill="currentColor"
              css={css`
                transform: scale(0.7);
              `}
            />
          )}
          <AnimatePresence>
            {!isStreaming && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18, ease: [0.2, 0.9, 0.2, 1] }}
              >
                PXI
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AriaButton>
  );
}

export type AgentChatWidgetProps = {
  boundaryRef?: RefObject<HTMLElement | null>;
};

export function AgentChatWidget({ boundaryRef }: AgentChatWidgetProps = {}) {
  const isAssistantAgentEnabled = useAssistantAgentEnabled();
  const isOpen = useAgentContext((state) => state.isOpen);
  const toggleOpen = useAgentContext((state) => state.toggleOpen);
  const fabPlacement = useAgentContext((state) => state.fabPlacement);
  const setFabPlacement = useAgentContext((state) => state.setFabPlacement);
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const isResponsePending = useAgentContext((state) =>
    activeSessionId
      ? (state.isResponsePendingBySessionId[activeSessionId] ?? false)
      : false
  );

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
      // (or any form field) so pressing the shortcut again toggles the popover
      // closed rather than being swallowed by the focused input.
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [isAssistantAgentEnabled, toggleOpen]
  );

  if (!isAssistantAgentEnabled) {
    return null;
  }

  return (
    <AgentFabPositioner
      boundaryRef={boundaryRef}
      isHidden={isOpen}
      placement={fabPlacement}
      size={isResponsePending ? FAB_STREAMING_SIZE : FAB_RESTING_SIZE}
      onActivate={toggleOpen}
      onPlacementChange={setFabPlacement}
    >
      <TooltipTrigger delay={1000} closeDelay={0}>
        <AgentChatWidgetButton
          ariaLabel="Open assistant"
          isDragHandle
          isStreaming={isResponsePending}
          onPress={(event) => {
            if (
              event.pointerType === "keyboard" ||
              event.pointerType === "virtual"
            ) {
              toggleOpen();
            }
          }}
        />
        <AgentChatWidgetTooltip />
      </TooltipTrigger>
    </AgentFabPositioner>
  );
}

export function AgentChatWidgetTooltip() {
  const modifierKey = useModifierKey();
  const modifierGlyph = modifierKey === "Cmd" ? "⌘" : "Ctrl";

  return (
    <Tooltip placement="top" offset={6}>
      <TooltipArrow />
      <Flex direction="row" gap="size-100" alignItems="center">
        <span>Open assistant</span>
        <Keyboard>
          <VisuallyHidden>{modifierKey}</VisuallyHidden>
          <span aria-hidden="true">{modifierGlyph}</span>
          <VisuallyHidden>i</VisuallyHidden>
          <span aria-hidden="true">I</span>
        </Keyboard>
      </Flex>
    </Tooltip>
  );
}
