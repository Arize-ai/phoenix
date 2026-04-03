import { css, keyframes } from "@emotion/react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";

import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

import { PxiGlyph } from "./PxiGlyph";

const shimmer = keyframes`
  0%, 100% { background-position: 200% center; }
  50%      { background-position: -200% center; }
`;

const breathe = keyframes`
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 0.7; }
`;

const gapTL = keyframes`
  0%, 70%, 100% { transform: translate(0.5px, 0.5px); }
  20%           { transform: translate(-0.5px, -0.5px); }
`;
const gapTR = keyframes`
  0%, 70%, 100% { transform: translate(-0.5px, 0.5px); }
  20%           { transform: translate(0.5px, -0.5px); }
`;
const gapBL = keyframes`
  0%, 70%, 100% { transform: translate(0.5px, -0.5px); }
  20%           { transform: translate(-0.5px, 0.5px); }
`;
const gapBR = keyframes`
  0%, 70%, 100% { transform: translate(-0.5px, -0.5px); }
  20%           { transform: translate(0.5px, 0.5px); }
`;

const buttonCSS = css`
  position: fixed;
  bottom: 24px;
  right: 36px;
  border: none;
  cursor: pointer;
  z-index: 1000;
  background: transparent;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const shapeCSS = css`
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
  overflow: hidden;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .fab-glyph {
    overflow: visible;
    flex-shrink: 0;
  }
`;

const thinkingDotsCSS = css`
  .fab-glyph circle {
    fill: var(--global-color-gray-50);
  }

  .fab-dot-center {
    animation: ${breathe} 2.5s ease-in-out infinite;
    animation-delay: 1s;
  }
  .fab-dot-tl {
    animation: ${gapTL} 2.5s ease-in-out infinite,
      ${breathe} 2.5s ease-in-out infinite;
    animation-delay: 0s, 0s;
  }
  .fab-dot-tr {
    animation: ${gapTR} 2.5s ease-in-out infinite,
      ${breathe} 2.5s ease-in-out infinite;
    animation-delay: 0.3s, 0.5s;
  }
  .fab-dot-br {
    animation: ${gapBR} 2.5s ease-in-out infinite,
      ${breathe} 2.5s ease-in-out infinite;
    animation-delay: 0.6s, 2s;
  }
  .fab-dot-bl {
    animation: ${gapBL} 2.5s ease-in-out infinite,
      ${breathe} 2.5s ease-in-out infinite;
    animation-delay: 0.9s, 1.5s;
  }
`;

const shimmerCSS = css`
  background: linear-gradient(
    120deg,
    var(--global-color-gray-900) 30%,
    var(--global-color-gray-800) 50%,
    var(--global-color-gray-900) 70%
  );
  background-size: 400% 100%;
  animation: ${shimmer} 10s ease-in-out infinite;
`;

const restingDotsCSS = css`
  .fab-glyph {
    transform: scale(0.7);
  }

  .fab-glyph circle {
    fill: var(--global-color-gray-100);
    opacity: 1;
    animation: none;
  }
`;

export function AgentChatWidget() {
  const isAgentsEnabled = useFeatureFlag("agents");
  const isOpen = useAgentContext((state) => state.isOpen);
  const toggleOpen = useAgentContext((state) => state.toggleOpen);

  // Agent panel doesn't currently comunicate state to the FAB, but the animations and transitions are ready for it.
  const isStreaming = false;

  if (!isAgentsEnabled || isOpen) {
    return null;
  }

  return createPortal(
    <button css={buttonCSS} onClick={toggleOpen} aria-label="Open agent chat">
      <motion.div
        css={[
          shapeCSS,
          isStreaming ? shimmerCSS : undefined,
          isStreaming ? thinkingDotsCSS : restingDotsCSS,
        ]}
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
          duration: 0.4,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        <PxiGlyph className="fab-glyph" fill="var(--global-color-gray-50)" />
        <AnimatePresence>
          {!isStreaming && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.3 }}
            >
              PXI
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </button>,
    document.body
  );
}
