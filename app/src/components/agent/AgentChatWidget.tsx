import { css, keyframes } from "@emotion/react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";

import { useTheme } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useHasOpenModal } from "@phoenix/hooks/useHasOpenModal";

import { PxiGlyph, type PxiGlyphThinkingVariant } from "./PxiGlyph";
import { useAssistantAgentEnabled } from "./useAssistantAgentEnabled";

const thinkingBorderWipe = keyframes`
  0% {
    -webkit-mask-position: 200% center;
    mask-position: 200% center;
  }

  100% {
    -webkit-mask-position: 0% center;
    mask-position: 0% center;
  }
`;

const ringBreathe = keyframes`
  0%, 100% {
    box-shadow: var(--agent-chat-widget-glow-outer-rest);
  }
  50% {
    box-shadow: var(--agent-chat-widget-glow-outer-strong);
  }
`;

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

const floatingButtonCSS = css`
  position: fixed;
  bottom: 24px;
  right: 36px;
  z-index: 1000;
`;

const inlineButtonCSS = css`
  position: relative;
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

const darkThemeThinkingGlowCSS = css`
  &[data-theme="dark"] {
    --agent-chat-widget-glow-outer-rest:
      0 0 2px 1px rgba(248, 242, 255, 0.78),
      0 0 4px 2px rgba(154, 102, 255, 0.68), 0 0 8px 4px rgba(52, 128, 255, 0.52),
      0 0 13px 5px rgba(198, 72, 255, 0.4), 0 0 17px 6px rgba(44, 216, 255, 0.26);
    --agent-chat-widget-glow-outer-strong:
      0 0 3px 2px rgba(250, 244, 255, 0.88),
      0 0 7px 3px rgba(160, 108, 255, 0.82),
      0 0 12px 6px rgba(58, 134, 255, 0.66),
      0 0 19px 8px rgba(205, 78, 255, 0.52),
      0 0 26px 10px rgba(50, 220, 255, 0.34);
  }
`;

const lightThemeThinkingGlowCSS = css`
  &[data-theme="light"] {
    --agent-chat-widget-glow-outer-rest:
      0 0 3px 1px rgba(245, 249, 255, 0.88),
      0 0 5px 2px rgba(199, 190, 242, 0.56), 0 0 9px 4px rgba(88, 152, 255, 0.54),
      0 0 14px 5px rgba(200, 150, 236, 0.23),
      0 0 20px 7px rgba(116, 212, 255, 0.17);
    --agent-chat-widget-glow-outer-strong:
      0 0 4px 1px rgba(248, 251, 255, 0.94),
      0 0 8px 3px rgba(203, 194, 244, 0.68),
      0 0 13px 5px rgba(96, 159, 255, 0.64),
      0 0 20px 7px rgba(205, 154, 238, 0.31),
      0 0 26px 9px rgba(119, 214, 255, 0.22);
  }
`;

const shapeCSS = css`
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

  .fab-glyph circle {
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
    position: absolute;
    inset: -28px;
    z-index: 0;
    border-radius: inherit;
    mix-blend-mode: plus-lighter;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(
      90deg,
      transparent 15%,
      black 45%,
      black 55%,
      transparent 85%
    );
    mask-image: linear-gradient(
      90deg,
      transparent 15%,
      black 45%,
      black 55%,
      transparent 85%
    );
    -webkit-mask-size: 200% 200%;
    mask-size: 200% 200%;
    -webkit-mask-position: center;
    mask-position: center;
    animation: ${thinkingBorderWipe} 3s linear infinite both -0.5s;
  }

  .agent-chat-widget__shimmer::before {
    content: "";
    position: absolute;
    inset: 28px;
    border-radius: inherit;
    opacity: 1;
  }

  .agent-chat-widget__shimmer::before {
    box-shadow: var(--agent-chat-widget-glow-outer-rest);
    animation: ${ringBreathe} 2400ms ease-in-out infinite;
    z-index: -1;
  }
`;

const restingHoverWipeCSS = css`
  .agent-chat-widget__content {
    opacity: 0.9;
  }

  .agent-chat-widget__hover-shimmer {
    position: absolute;
    inset: -28px;
    z-index: 0;
    border-radius: inherit;
    mix-blend-mode: plus-lighter;
    pointer-events: none;
    opacity: 0;
    -webkit-mask-image: linear-gradient(
      90deg,
      transparent 15%,
      black 45%,
      black 55%,
      transparent 85%
    );
    mask-image: linear-gradient(
      90deg,
      transparent 15%,
      black 45%,
      black 55%,
      transparent 85%
    );
    -webkit-mask-size: 200% 200%;
    mask-size: 200% 200%;
    -webkit-mask-position: 200% center;
    mask-position: 200% center;
    transition: opacity 160ms ease-out;
  }

  .agent-chat-widget__hover-shimmer::before {
    content: "";
    position: absolute;
    inset: 28px;
    border-radius: inherit;
    box-shadow: var(--agent-chat-widget-glow-outer-rest);
    opacity: 0.95;
  }

  &:hover .agent-chat-widget__hover-shimmer {
    opacity: 1;
    animation: ${thinkingBorderWipe} 900ms cubic-bezier(0.22, 0.8, 0.24, 1)
      1 both;
  }

  &:hover .agent-chat-widget__hover-shimmer::before {
    animation: ${ringBreathe} 2400ms ease-in-out infinite;
  }

  &:hover .agent-chat-widget__content {
    opacity: 1;
  }
`;

const thinkingGlyphPulseCSS = css`
  .agent-chat-widget__content {
    animation: ${glyphBreathe} 2400ms ease-in-out infinite;
  }
`;

export type { PxiGlyphThinkingVariant } from "./PxiGlyph";

export interface AgentChatWidgetButtonProps {
  isStreaming?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  isFloating?: boolean;
  thinkingGlyphVariant?: PxiGlyphThinkingVariant;
}

export function AgentChatWidgetButton({
  isStreaming = false,
  onClick,
  ariaLabel = "Open agent chat",
  isFloating = false,
  thinkingGlyphVariant = "wave-reveal",
}: AgentChatWidgetButtonProps) {
  const { theme } = useTheme();
  return (
    <button
      type="button"
      css={
        isFloating
          ? [buttonCSS, floatingButtonCSS]
          : [buttonCSS, inlineButtonCSS]
      }
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <motion.div
        css={[
          shapeCSS,
          darkThemeGlyphThemeCSS,
          lightThemeGlyphThemeCSS,
          darkThemeThinkingGlowCSS,
          lightThemeThinkingGlowCSS,
          !isStreaming ? [thinkingBorderCSS, restingHoverWipeCSS] : undefined,
          isStreaming ? thinkingBorderCSS : undefined,
          isStreaming ? thinkingGlyphPulseCSS : undefined,
        ]}
        data-theme={theme}
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
                variant="thinking"
                thinkingVariant={thinkingGlyphVariant}
              />
            </div>
          ) : (
            <PxiGlyph
              className="fab-glyph"
              fill="currentColor"
              variant="resting"
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
    </button>
  );
}

export function AgentChatWidget() {
  const isAssistantAgentEnabled = useAssistantAgentEnabled();
  const isOpen = useAgentContext((state) => state.isOpen);
  const toggleOpen = useAgentContext((state) => state.toggleOpen);
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const hasOpenModal = useHasOpenModal();
  const isStreaming = useAgentContext((state) =>
    activeSessionId
      ? state.chatStatusBySessionId[activeSessionId] === "streaming"
      : false
  );

  // Use contextual entrypoints inside modals (e.g. trace slideover header)
  // instead of letting the global FAB compete with overlay hit-testing.
  if (!isAssistantAgentEnabled || isOpen || hasOpenModal) {
    return null;
  }

  return createPortal(
    <AgentChatWidgetButton
      isStreaming={isStreaming}
      onClick={toggleOpen}
      isFloating
    />,
    document.body
  );
}
