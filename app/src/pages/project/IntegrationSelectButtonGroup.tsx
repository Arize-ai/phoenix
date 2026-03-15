import { css } from "@emotion/react";
import type { Key } from "react";

import { ToggleButton, ToggleButtonGroup } from "@phoenix/components";

import type { OnboardingIntegration } from "./integrationDefinitions";
import { ONBOARDING_INTEGRATIONS } from "./integrationRegistry";

const integrationSelectorCSS = css`
  .integration-selector__group {
    flex-wrap: wrap;
    gap: var(--global-dimension-size-100);
  }

  .integration-selector__toggle {
    border-radius: var(--global-rounding-small) !important;
    padding: var(--global-dimension-size-100) !important;
    & svg {
      height: 20px;
      width: 20px;
    }
  }

  .integration-selector__toggle[data-selected="true"] {
    // fix layout shift caused by margin-left: -1px in ToggleButtonGroup
    margin: 0 !important;
  }

  .integration-selector__toggle:not([data-selected="true"]) {
    border-left: 1px solid var(--button-border-color) !important;
  }
`;

function getSelectedKey(selection: Set<Key> | "all"): string | null {
  if (selection === "all" || selection.size === 0) {
    return null;
  }
  return String(selection.keys().next().value);
}

export function IntegrationSelectButtonGroup({
  selectedIntegration,
  onSelectionChange,
}: {
  selectedIntegration: OnboardingIntegration;
  onSelectionChange: (integration: OnboardingIntegration) => void;
}) {
  return (
    <div css={integrationSelectorCSS}>
      <ToggleButtonGroup
        aria-label="Integration"
        selectedKeys={[selectedIntegration.id]}
        disallowEmptySelection
        selectionMode="single"
        size="M"
        className="integration-selector__group"
        onSelectionChange={(selection) => {
          const nextKey = getSelectedKey(selection);
          if (nextKey == null) {
            return;
          }
          const nextIntegration = ONBOARDING_INTEGRATIONS.find(
            (i) => i.id === nextKey
          );
          if (nextIntegration) {
            onSelectionChange(nextIntegration);
          }
        }}
      >
        {ONBOARDING_INTEGRATIONS.map((i) => (
          <ToggleButton
            key={i.id}
            id={i.id}
            aria-label={i.name}
            className="integration-selector__toggle"
            leadingVisual={i.icon}
          >
            {i.name}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
