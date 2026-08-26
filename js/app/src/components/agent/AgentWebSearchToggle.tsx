import { css } from "@emotion/react";
import { ToggleButton as AriaToggleButton } from "react-aria-components";

import {
  Icon,
  Icons,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

const webSearchToggleCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  flex: none;
  border: none;
  background-color: transparent;
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-50) var(--global-dimension-size-75);
  margin: 0;
  cursor: pointer;
  color: var(--global-text-color-500);
  opacity: var(--global-opacity-disabled);
  font-size: var(--global-font-size-s);
  line-height: 1;
  transition:
    color 0.2s ease,
    opacity 0.2s ease,
    background-color 0.2s ease;

  .web-search-toggle__icon {
    display: inline-flex;
    font-size: var(--global-font-size-l);
  }

  &[data-hovered] {
    background-color: var(--hover-background);
    color: var(--global-text-color-700);
    opacity: 1;
  }

  &[data-selected="true"] {
    color: var(--global-color-blue-700);
    opacity: 1;
  }

  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`;

export function AgentWebSearchToggle() {
  const store = useAgentStore();
  const isWebSearchEnabled = useAgentContext(
    (state) => state.capabilities["web.access"]
  );
  const isWebAccessAvailable = useAgentContext(
    (state) => state.agentsConfig.webAccessEnabled
  );

  if (!isWebAccessAvailable) {
    return null;
  }

  return (
    <TooltipTrigger delay={500} closeDelay={0}>
      <AriaToggleButton
        aria-label="Search the web"
        isSelected={isWebSearchEnabled}
        onChange={(enabled) =>
          store.getState().setCapability({ key: "web.access", enabled })
        }
        css={webSearchToggleCSS}
      >
        <span className="web-search-toggle__icon">
          <Icon svg={<Icons.Globe />} />
        </span>
        {isWebSearchEnabled ? <span>Search</span> : null}
      </AriaToggleButton>
      <Tooltip placement="top" offset={6}>
        <TooltipArrow />
        {isWebSearchEnabled ? "Web search on" : "Search the web"}
      </Tooltip>
    </TooltipTrigger>
  );
}
