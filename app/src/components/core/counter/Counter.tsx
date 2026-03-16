import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

export type CounterProps = PropsWithChildren<{
  /**
   * The color of the counter
   * @default 'default'
   **/
  variant?: "default" | "danger" | "quiet";
}>;

const counterCSS = css`
  display: inline-block;
  padding: 0 var(--global-dimension-size-50);
  border-radius: var(--global-rounding-large);
  border: 1px solid var(--global-color-gray-300);
  min-width: var(--global-dimension-size-150);
  background-color: var(--global-color-gray-200);
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);
  text-align: center;
  color: var(--global-text-color-900);
  font-family: "Geist Mono", monospace;
  &[data-variant="danger"] {
    background-color: var(--global-color-danger-700);
  }
  &[data-variant="quiet"] {
    border: none;
    background: transparent;
    color: var(--global-text-color-500);
  }
`;

/**
 * A component to show the count of something (e.x. in a tab)
 */
export function Counter(props: CounterProps) {
  const { children, variant = "default" } = props;
  return (
    <span css={counterCSS} data-variant={variant} className="counter">
      {children}
    </span>
  );
}
