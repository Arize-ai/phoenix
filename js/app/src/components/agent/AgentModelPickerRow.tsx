import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Badge, Icon, Icons, Text } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import type { GenerativeProviderKey } from "@phoenix/components/generative/useModelMenuData";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import {
  type AgentModelCatalogRow,
  type AgentModelCredentialState,
  getAgentModelHighlightRanges,
  getAgentModelProviderHighlightQuery,
} from "./agentModelSearch";

const highlightCSS = css`
  /* color-mix rather than the -rgb companion, which only the dark theme defines */
  background-color: color-mix(
    in srgb,
    var(--global-color-blue-500) 30%,
    transparent
  );
  color: inherit;
  border-radius: var(--global-rounding-xsmall);
`;

/**
 * Renders `text` with the parts that match `query` marked, see
 * {@link getAgentModelHighlightRanges}.
 */
export function AgentModelHighlight({
  text,
  query,
}: {
  text: string;
  query?: string;
}) {
  const ranges = query ? getAgentModelHighlightRanges({ text, query }) : [];
  if (ranges.length === 0) {
    return <>{text}</>;
  }
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} css={highlightCSS}>
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * The provider icon for a row. Nothing for a provider key the icon set
 * doesn't know, so a future key can't break the picker.
 */
export function AgentModelProviderIcon({
  provider,
}: {
  provider: GenerativeProviderKey;
}) {
  return isModelProvider(provider) ? (
    <GenerativeProviderIcon provider={provider} height={16} />
  ) : null;
}

/**
 * A row's credential state: nothing when ready, "May work" for providers
 * with an ambient credential chain (AWS, Azure), "Add key" when a key is
 * missing, and "Unavailable" when the row's custom provider was deleted.
 */
export function AgentModelCredentialHint({
  credentialState,
  isProviderMissing = false,
}: {
  credentialState: AgentModelCredentialState;
  isProviderMissing?: boolean;
}) {
  if (isProviderMissing) {
    return (
      <Badge size="S" variant="danger">
        Unavailable
      </Badge>
    );
  }
  if (credentialState === "may-work") {
    return (
      <Text size="XS" color="text-500">
        May work
      </Text>
    );
  }
  if (credentialState === "no-key") {
    return (
      <Badge size="S" variant="warning">
        Add key
      </Badge>
    );
  }
  return null;
}

const modelRowCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  width: 100%;

  .agent-model-row__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
  }

  .agent-model-row__name,
  .agent-model-row__secondary {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .agent-model-row__secondary {
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
  }

  .agent-model-row__trailing {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-75);
  }
`;

/**
 * The content of one picker row: an icon, a name line, a muted second line
 * and trailing badges.
 */
export function AgentModelRowLayout({
  leadingVisual,
  name,
  secondary,
  trailing,
}: {
  /** Usually an {@link AgentModelProviderIcon} */
  leadingVisual?: ReactNode;
  name: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <span css={modelRowCSS} className="agent-model-row">
      {leadingVisual}
      <span className="agent-model-row__text">
        <span className="agent-model-row__name">{name}</span>
        {secondary ? (
          <span className="agent-model-row__secondary">{secondary}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="agent-model-row__trailing">{trailing}</span>
      ) : null}
    </span>
  );
}

/**
 * A catalog model row. Curated models show their display name with
 * `<id> · <provider>` below; every other model shows its raw id with the
 * provider below. Both lines highlight the query; the provider label only
 * where a token names the provider.
 */
export function AgentModelRow({
  row,
  query,
  showRecommendedBadge = false,
}: {
  row: AgentModelCatalogRow;
  query?: string;
  /** Marks curated rows in search results; the empty state has a section */
  showRecommendedBadge?: boolean;
}) {
  const isRecommendedBadgeVisible = showRecommendedBadge && row.isCurated;
  const providerLabel = (
    <AgentModelHighlight
      text={row.providerName}
      query={
        query ? getAgentModelProviderHighlightQuery({ row, query }) : undefined
      }
    />
  );
  const credentialHint = (
    <AgentModelCredentialHint
      credentialState={row.credentialState}
      isProviderMissing={row.isProviderMissing}
    />
  );
  return (
    <AgentModelRowLayout
      leadingVisual={
        row.isProviderMissing ? (
          <Icon svg={<Icons.AlertTriangle />} color="warning" />
        ) : (
          <AgentModelProviderIcon provider={row.provider} />
        )
      }
      name={
        <AgentModelHighlight
          text={row.displayName ?? row.modelName}
          query={query}
        />
      }
      secondary={
        row.displayName ? (
          <>
            <AgentModelHighlight text={row.modelName} query={query} />
            {" · "}
            {providerLabel}
          </>
        ) : (
          providerLabel
        )
      }
      trailing={
        isRecommendedBadgeVisible ||
        row.isProviderMissing ||
        row.credentialState !== "ready" ? (
          <>
            {isRecommendedBadgeVisible ? (
              <Badge size="S" variant="success">
                Recommended
              </Badge>
            ) : null}
            {credentialHint}
          </>
        ) : null
      }
    />
  );
}
