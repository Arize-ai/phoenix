import { css } from "@emotion/react";
import type { ReactNode } from "react";

const statusTextCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-75);
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);
  color: var(--global-text-color-700);
  white-space: nowrap;
  &::before {
    content: "";
    flex: none;
    width: var(--global-dimension-size-75);
    height: var(--global-dimension-size-75);
    border-radius: var(--global-rounding-full);
    background-color: currentColor;
  }
  &[data-tone="success"] {
    color: var(--global-color-success);
  }
  &[data-tone="warning"] {
    color: var(--global-color-warning);
  }
  &[data-tone="danger"] {
    color: var(--global-color-danger);
  }
`;

export type StatusTone = "neutral" | "success" | "warning" | "danger";

/**
 * A short status label with a leading dot in the tone's color — the shared
 * treatment for model readiness across the AI query settings surfaces, so
 * "Ready" beside a radio option and "Downloaded and ready" in a card header
 * read as the same signal.
 */
export function StatusText({
  tone = "neutral",
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return (
    <span css={statusTextCSS} data-tone={tone}>
      {children}
    </span>
  );
}
