import { PropsWithChildren } from "react";
import { css } from "@emotion/react";

export type CounterProps = PropsWithChildren<{
  /**
   * The color of the counter
   * @default 'default'
   **/
  variant?: "default" | "danger";
}>;

const counterCSS = css`
  display: inline-block;
  padding: 0 var(--global-dimension-size-50);
  border-radius: var(--global-rounding-large);
  border: 1px solid var(--global-color-gray-300);
  min-width: var(--global-dimension-size-150);
  background-color: var(--global-background-color-light);
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);
  text-align: center;
  color: var(--global-text-color-900);
  &[data-variant="danger"] {
    background-color: var(--global-background-color-danger);
  }
`;

/**
 * A component to show the count of something (e.x. in a tab)
 */
export function Counter(props: CounterProps) {
  const { children, variant = "default" } = props;
  return (
    <span css={counterCSS} data-variant={variant} className="ac-counter">
      {children}
    </span>
  );
}
