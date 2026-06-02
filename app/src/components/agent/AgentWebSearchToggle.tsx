import { css } from "@emotion/react";
import { ToggleButton as AriaToggleButton } from "react-aria-components";

import { Icon, Icons } from "@phoenix/components";
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

  .web-search-toggle__label {
    display: none;
  }

  &[data-hovered] {
    background-color: var(--hover-background);
    color: var(--global-text-color-700);
    opacity: 1;

    .web-search-toggle__label {
      display: inline;
    }
  }

  &[data-selected="true"] {
    color: var(--global-color-blue-700);
    opacity: 1;

    .web-search-toggle__label {
      display: inline;
    }
  }

  &[data-focus-visible] {
    outline: var(--global-border-size-thick) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`;

/**
 * Globe toggle rendered next to the agent model selector. Flips the
 * `web.access` capability so the agent can use provider-native web search for
 * the current chat. Renders as a quiet icon when off (with slash-through globe)
 * and turns blue with a "Search" label when on. Shows "Search off" on hover
 * when disabled. Hidden when the deployment has not enabled web access.
 */
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
    <AriaToggleButton
      aria-label={isWebSearchEnabled ? "Web search on" : "Search the web"}
      isSelected={isWebSearchEnabled}
      onChange={(enabled) =>
        store.getState().setCapability({ key: "web.access", enabled })
      }
      css={webSearchToggleCSS}
    >
      <span className="web-search-toggle__icon">
        <Icon
          svg={
            isWebSearchEnabled ? (
              <Icons.GlobeOutline />
            ) : (
              <Icons.GlobeOffOutline />
            )
          }
        />
      </span>
      <span className="web-search-toggle__label">
        {isWebSearchEnabled ? "Search" : "Search off"}
      </span>
    </AriaToggleButton>
  );
}
