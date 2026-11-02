import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Badge, Icon, Icons } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import type { GenerativeProviderKey } from "@phoenix/components/generative/useModelMenuData";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import {
  type ModelCatalogRow,
  type ModelCredentialState,
  getModelHighlightRanges,
  getProviderHighlightQuery,
} from "./modelSearch";

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
 * {@link getModelHighlightRanges}.
 */
export function ModelHighlight({
  text,
  query,
}: {
  text: string;
  query?: string;
}) {
  const ranges = query ? getModelHighlightRanges({ text, query }) : [];
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
export function ModelProviderIcon({
  provider,
}: {
  provider: GenerativeProviderKey;
}) {
  return isModelProvider(provider) ? (
    <GenerativeProviderIcon provider={provider} height={16} />
  ) : null;
}

/**
 * A row's credential state: "Add key" when a key is missing, "Unavailable"
 * when the row's custom provider was deleted, and nothing otherwise. Providers
 * with an ambient credential chain (AWS, Azure) show nothing: whether that
 * chain works can't be told until a send.
 */
export function ModelCredentialHint({
  credentialState,
  isProviderMissing = false,
}: {
  credentialState: ModelCredentialState;
  isProviderMissing?: boolean;
}) {
  if (isProviderMissing) {
    return (
      <Badge size="S" variant="danger">
        Unavailable
      </Badge>
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

  .model-row__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
  }

  .model-row__name,
  .model-row__secondary {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .model-row__secondary {
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
  }

  .model-row__trailing {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-75);
  }

  /* A row with no badges renders an empty trailing slot; drop it so it adds
     no gap */
  .model-row__trailing:empty {
    display: none;
  }
`;

/**
 * The content of one picker row: an icon, a name line, a muted second line
 * and trailing badges.
 */
export function ModelRowLayout({
  leadingVisual,
  name,
  secondary,
  trailing,
}: {
  /** Usually an {@link ModelProviderIcon} */
  leadingVisual?: ReactNode;
  name: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <span css={modelRowCSS} className="model-row">
      {leadingVisual}
      <span className="model-row__text">
        <span className="model-row__name">{name}</span>
        {secondary ? (
          <span className="model-row__secondary">{secondary}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="model-row__trailing">{trailing}</span>
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
export function ModelRow({
  row,
  query,
  showRecommendedBadge = false,
}: {
  row: ModelCatalogRow;
  query?: string;
  /** Marks curated rows in search results; the empty state has a section */
  showRecommendedBadge?: boolean;
}) {
  const isRecommendedBadgeVisible = showRecommendedBadge && row.isCurated;
  const providerLabel = (
    <ModelHighlight
      text={row.providerName}
      query={query ? getProviderHighlightQuery({ row, query }) : undefined}
    />
  );
  return (
    <ModelRowLayout
      leadingVisual={
        row.isProviderMissing ? (
          <Icon svg={<Icons.AlertTriangle />} color="warning" />
        ) : (
          <ModelProviderIcon provider={row.provider} />
        )
      }
      name={
        <ModelHighlight text={row.displayName ?? row.modelName} query={query} />
      }
      secondary={
        row.displayName ? (
          <>
            <ModelHighlight text={row.modelName} query={query} />
            {" · "}
            {providerLabel}
          </>
        ) : (
          providerLabel
        )
      }
      trailing={
        <>
          {isRecommendedBadgeVisible ? (
            <Badge size="S" variant="success">
              Recommended
            </Badge>
          ) : null}
          <ModelCredentialHint
            credentialState={row.credentialState}
            isProviderMissing={row.isProviderMissing}
          />
        </>
      }
    />
  );
}
