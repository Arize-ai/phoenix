import { css, keyframes } from "@emotion/react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";

import { ProgressCircle } from "@phoenix/components/core/progress";
import { useTheme } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useHasOpenModal } from "@phoenix/hooks/useHasOpenModal";

import { PxiGlyph, type PxiGlyphThinkingVariant } from "./PxiGlyph";
import { useAssistantAgentEnabled } from "./useAssistantAgentEnabled";

const shimmer = keyframes`
  0%, 100% { background-position: 200% center; }
  50%      { background-position: -200% center; }
`;

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

const shapeCSS = css`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--global-color-gray-900);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  color: var(--global-color-gray-50);
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

  .agent-chat-widget__spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    isolation: isolate;
    flex-shrink: 0;
  }
`;

const lightRestingShapeCSS = css`
  color: var(--global-color-gray-900);
  background:
    radial-gradient(
      140% 150% at 18% 12%,
      rgba(255, 255, 255, 0.96) 0%,
      rgba(255, 255, 255, 0) 36%
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 1) 0%,
      rgba(233, 239, 245, 1) 42%,
      rgba(214, 223, 232, 1) 58%,
      rgba(244, 248, 252, 1) 100%
    );
  box-shadow:
    0 0 0 1px rgba(163, 175, 188, 0.92) inset,
    0 1px 0 rgba(255, 255, 255, 0.98) inset,
    0 10px 18px rgba(255, 255, 255, 0.62) inset,
    0 -11px 15px rgba(104, 119, 135, 0.24) inset,
    0 0 0 1px rgba(242, 247, 252, 0.8),
    0 14px 28px rgba(98, 115, 132, 0.24),
    0 3px 9px rgba(255, 255, 255, 0.82);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.76);
  transition: box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: box-shadow;

  .agent-chat-widget__hover-bg-shimmer {
    background:
      linear-gradient(
        115deg,
        rgba(255, 255, 255, 0) 16%,
        rgba(255, 255, 255, 0.96) 39%,
        rgba(190, 204, 219, 0.52) 50%,
        rgba(255, 255, 255, 0) 69%
      ),
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.46) 0%,
        rgba(255, 255, 255, 0) 100%
      );
    background-size:
      220% 100%,
      100% 100%;
    background-position:
      200% center,
      center;
    mix-blend-mode: screen;
    opacity: 0.58;
    animation-duration: 4.8s;
  }

  .agent-chat-widget__hover-shimmer {
    inset: -18px;
    mix-blend-mode: normal;
  }

  .agent-chat-widget__hover-shimmer::before {
    inset: 18px;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.88),
      0 0 0 2px rgba(193, 208, 224, 0.82),
      0 0 16px rgba(163, 181, 201, 0.28),
      0 10px 22px rgba(112, 129, 146, 0.18);
    opacity: 0.76;
  }

  &:hover {
    background:
      radial-gradient(
        145% 155% at 18% 12%,
        rgba(255, 255, 255, 0.98) 0%,
        rgba(255, 255, 255, 0) 39%
      ),
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 1) 0%,
        rgba(239, 245, 250, 1) 40%,
        rgba(219, 228, 236, 1) 57%,
        rgba(248, 251, 254, 1) 100%
      );
    box-shadow:
      0 0 0 1px rgba(188, 199, 211, 0.98) inset,
      0 1px 0 rgba(255, 255, 255, 0.98) inset,
      0 12px 22px rgba(255, 255, 255, 0.7) inset,
      0 -14px 18px rgba(106, 121, 137, 0.28) inset,
      0 0 0 1px rgba(246, 250, 255, 0.88),
      0 18px 34px rgba(90, 107, 123, 0.28),
      0 4px 10px rgba(255, 255, 255, 0.88);
  }

  &:hover .agent-chat-widget__hover-bg-shimmer {
    opacity: 1;
  }

  &:hover .agent-chat-widget__hover-shimmer::before {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.96),
      0 0 0 2px rgba(214, 226, 238, 0.9),
      0 0 22px rgba(171, 190, 210, 0.36),
      0 16px 30px rgba(101, 118, 135, 0.24);
    opacity: 0.96;
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
`;

const restingHoverShimmerCSS = css`
  .agent-chat-widget__hover-bg-shimmer {
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(
      120deg,
      var(--global-color-gray-900) 30%,
      var(--global-color-gray-800) 50%,
      var(--global-color-gray-900) 70%
    );
    background-size: 400% 100%;
    background-position: 200% center;
    animation: ${shimmer} 10s ease-in-out infinite;
    opacity: 0;
    transition: opacity 160ms ease-out;
  }

  &:hover .agent-chat-widget__hover-bg-shimmer {
    opacity: 1;
  }
`;

const thinkingBorderCSS = css`
  --agent-chat-widget-glow-outer-rest:
    0 0 2px 1px rgba(248, 242, 255, 0.78),
    0 0 4px 2px rgba(154, 102, 255, 0.68),
    0 0 8px 4px rgba(52, 128, 255, 0.52),
    0 0 13px 5px rgba(198, 72, 255, 0.4),
    0 0 17px 6px rgba(44, 216, 255, 0.26);
  --agent-chat-widget-glow-outer-strong:
    0 0 3px 2px rgba(250, 244, 255, 0.88),
    0 0 7px 3px rgba(160, 108, 255, 0.82),
    0 0 12px 6px rgba(58, 134, 255, 0.66),
    0 0 19px 8px rgba(205, 78, 255, 0.52),
    0 0 26px 10px rgba(50, 220, 255, 0.34);

  &[data-theme="light"] {
    --agent-chat-widget-glow-outer-rest:
      0 0 2px 1px rgba(234, 243, 255, 0.72),
      0 0 5px 2px rgba(118, 180, 255, 0.42),
      0 0 8px 4px rgba(56, 132, 255, 0.24),
      0 0 13px 4px rgba(23, 93, 215, 0.14);
    --agent-chat-widget-glow-outer-strong:
      0 0 3px 1px rgba(242, 248, 255, 0.8),
      0 0 7px 3px rgba(131, 189, 255, 0.5),
      0 0 13px 6px rgba(67, 143, 255, 0.32),
      0 0 19px 6px rgba(29, 101, 223, 0.18);
  }

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
`;

const lightThinkingShapeCSS = css`
  color: var(--global-color-gray-900);
  background:
    radial-gradient(
      140% 150% at 18% 12%,
      rgba(255, 255, 255, 0.96) 0%,
      rgba(255, 255, 255, 0) 36%
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 1) 0%,
      rgba(237, 243, 248, 1) 42%,
      rgba(219, 228, 236, 1) 58%,
      rgba(246, 249, 252, 1) 100%
    );
  box-shadow:
    0 0 0 1px rgba(170, 182, 194, 0.9) inset,
    0 1px 0 rgba(255, 255, 255, 0.98) inset,
    0 10px 18px rgba(255, 255, 255, 0.58) inset,
    0 -11px 15px rgba(107, 122, 137, 0.2) inset,
    0 0 0 1px rgba(244, 248, 252, 0.82),
    0 14px 28px rgba(98, 115, 132, 0.22),
    0 3px 9px rgba(255, 255, 255, 0.82);
  color: var(--global-color-gray-900);
`;

export type AgentChatWidgetButtonVariant = "dark" | "dark-glyph" | "light";
export type { PxiGlyphThinkingVariant } from "./PxiGlyph";

export interface AgentChatWidgetButtonProps {
  isStreaming?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  isFloating?: boolean;
  thinkingGlyphVariant?: PxiGlyphThinkingVariant;
  variant?: AgentChatWidgetButtonVariant;
}

export function AgentChatWidgetButton({
  isStreaming = false,
  onClick,
  ariaLabel = "Open agent chat",
  isFloating = false,
  thinkingGlyphVariant = "orbit-reveal",
  variant = "dark",
}: AgentChatWidgetButtonProps) {
  const usesThinkingGlyph = variant === "dark-glyph" || variant === "light";
  const { theme } = useTheme();
  const isLightAppearance = variant === "light" && theme === "light";
  const glyphFill = isLightAppearance
    ? "var(--global-color-gray-800)"
    : "var(--global-color-gray-100)";
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
          !isStreaming && !isLightAppearance
            ? [thinkingBorderCSS, restingHoverWipeCSS, restingHoverShimmerCSS]
            : undefined,
          !isStreaming && isLightAppearance
            ? [
                lightRestingShapeCSS,
                restingHoverWipeCSS,
                restingHoverShimmerCSS,
              ]
            : undefined,
          isStreaming ? thinkingBorderCSS : undefined,
          isStreaming && isLightAppearance ? lightThinkingShapeCSS : undefined,
        ]}
        data-variant={variant}
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
          <span className="agent-chat-widget__hover-bg-shimmer" />
        ) : null}
        {!isStreaming ? (
          <span className="agent-chat-widget__hover-shimmer" />
        ) : null}
        {isStreaming ? <span className="agent-chat-widget__shimmer" /> : null}
        <div css={shapeContentCSS}>
          {isStreaming ? (
            <div className="agent-chat-widget__spinner">
              {usesThinkingGlyph ? (
                <PxiGlyph
                  className="fab-glyph"
                  fill={glyphFill}
                  variant="thinking"
                  thinkingVariant={thinkingGlyphVariant}
                />
              ) : (
                <ProgressCircle
                  isIndeterminate
                  size="S"
                  aria-label="PXI is thinking"
                />
              )}
            </div>
          ) : (
            <PxiGlyph
              className="fab-glyph"
              fill={glyphFill}
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
