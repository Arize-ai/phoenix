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
  padding: 0 var(--ac-global-dimension-size-50);
  border-radius: var(--ac-global-rounding-large);
  border: 1px solid var(--ac-global-color-grey-300);
  min-width: var(--ac-global-dimension-size-150);
  background-color: var(--ac-global-background-color-light);
  font-size: var(--ac-global-font-size-xs);
  line-height: var(--ac-global-line-height-xs);
  text-align: center;
  color: var(--ac-global-text-color-900);
  &[data-variant="danger"] {
    background-color: var(--ac-global-background-color-danger);
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
