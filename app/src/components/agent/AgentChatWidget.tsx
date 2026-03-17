import { css } from "@emotion/react";
import { createPortal } from "react-dom";

import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";

const widgetCSS = css`
  position: fixed;
  bottom: 24px;
  right: 24px;
  height: 36px;
  border-radius: var(--global-rounding-medium);
  border: none;
  background-color: var(--global-color-primary);
  color: var(--global-color-gray-50);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--global-dimension-size-150);
  font-size: var(--global-font-size-s);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  z-index: 1000;
  transition: transform 150ms ease;

  &:hover {
    transform: scale(1.05);
  }
`;

export function AgentChatWidget() {
  const isAgentsEnabled = useFeatureFlag("agents");
  const isOpen = useAgentContext((state) => state.isOpen);
  const toggleOpen = useAgentContext((state) => state.toggleOpen);

  if (!isAgentsEnabled || isOpen) {
    return null;
  }

  return createPortal(
    <button css={widgetCSS} onClick={toggleOpen} aria-label="Open agent chat">
      PXI
    </button>,
    document.body
  );
}
