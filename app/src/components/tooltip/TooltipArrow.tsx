import { forwardRef, Ref } from "react";
import { OverlayArrow } from "react-aria-components";

import { classNames } from "@arizeai/components";

import { StylableProps } from "../types";

export interface TooltipArrowProps extends StylableProps {}

function TooltipArrow(props: TooltipArrowProps, ref: Ref<HTMLDivElement>) {
  const { css: propCSS } = props;

  return (
    <OverlayArrow
      ref={ref}
      css={propCSS}
      className={classNames("react-aria-OverlayArrow")}
    >
      <svg width={8} height={8} viewBox="0 0 8 8">
        <path d="M0 0 L4 4 L8 0" />
      </svg>
    </OverlayArrow>
  );
}

const _TooltipArrow = forwardRef(TooltipArrow);
export { _TooltipArrow as TooltipArrow };
