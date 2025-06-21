import { forwardRef, Ref } from "react";
import { OverlayArrow } from "react-aria-components";
import { css, SerializedStyles } from "@emotion/react";

const arrowCSS = css`
  & svg {
    display: block;
    fill: var(--ac-global-tooltip-background-color);
    stroke: var(--ac-global-tooltip-border-color);
    stroke-width: 1px;
  }
`;

export interface TooltipArrowProps {
  /**
   * Custom CSS to apply to the arrow
   */
  css?: SerializedStyles;
}

function TooltipArrow(props: TooltipArrowProps, ref: Ref<HTMLDivElement>) {
  const { css: propCSS } = props;

  return (
    <OverlayArrow ref={ref} css={css(arrowCSS, propCSS)}>
      <svg width={8} height={8} viewBox="0 0 8 8">
        <path d="M0 0 L4 4 L8 0" />
      </svg>
    </OverlayArrow>
  );
}

const _TooltipArrow = forwardRef(TooltipArrow);
export { _TooltipArrow as TooltipArrow };
