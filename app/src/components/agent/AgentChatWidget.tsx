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
        css={[shapeCSS, isStreaming ? shimmerCSS : undefined]}
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
        <PxiGlyph
          className="fab-glyph"
          fill={
            isStreaming
              ? "var(--global-color-gray-50)"
              : "var(--global-color-gray-100)"
          }
          variant={isStreaming ? "thinking" : "resting"}
        />
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
