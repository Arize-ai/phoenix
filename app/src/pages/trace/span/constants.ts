import { css } from "@emotion/react";

import type { CardProps } from "@phoenix/components";

/**
 * Card props to apply across all cards in the span details view
 */
export const defaultCardProps: Partial<CardProps> = {
  collapsible: true,
};

/**
 * Styles for the vertical list of documents rendered inside a reranker span's
 * input / output cards.
 */
export const documentsListCSS = css`
  padding: var(--global-dimension-size-200);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
`;
