import { css } from "@emotion/react";
import type { Key } from "react";
import { useMemo, useState } from "react";

import {
  Button,
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";
import { DebouncedSearch } from "@phoenix/components/core/field";

import type { OnboardingIntegration } from "./integrationDefinitions";
import { ONBOARDING_INTEGRATIONS } from "./integrationRegistry";

const COLLAPSED_INTEGRATION_COUNT = 15;

const integrationSelectorCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);

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
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredIntegrations = useMemo(() => {
    if (!searchQuery) return ONBOARDING_INTEGRATIONS;
    const query = searchQuery.toLowerCase();
    return ONBOARDING_INTEGRATIONS.filter(
      (i) =>
        i.id === selectedIntegration.id || i.name.toLowerCase().includes(query)
    );
  }, [searchQuery, selectedIntegration.id]);

  const isSearching = searchQuery.length > 0;
  const showAll = isExpanded || isSearching;
  const visibleIntegrations = showAll
    ? filteredIntegrations
    : filteredIntegrations.slice(0, COLLAPSED_INTEGRATION_COUNT);
  const hasMore = filteredIntegrations.length > COLLAPSED_INTEGRATION_COUNT;

  const handleSelectionChange = (selection: Set<Key> | "all") => {
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
  };

  return (
    <div css={integrationSelectorCSS}>
      <DebouncedSearch
        aria-label="Search integrations"
        placeholder="Search integrations"
        size="M"
        onChange={setSearchQuery}
      />
      <ToggleButtonGroup
        aria-label="Integration"
        selectedKeys={[selectedIntegration.id]}
        disallowEmptySelection
        selectionMode="single"
        size="M"
        className="integration-selector__group"
        onSelectionChange={handleSelectionChange}
      >
        {visibleIntegrations.map((i) => (
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
      {hasMore && !isSearching && (
        <Button
          variant="quiet"
          size="S"
          trailingVisual={
            <Icon
              svg={isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
            />
          }
          onPress={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          css={css`
            align-self: center;
          `}
        >
          {isExpanded ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}
