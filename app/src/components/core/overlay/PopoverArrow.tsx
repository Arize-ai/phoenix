import type { Ref } from "react";
import { forwardRef } from "react";
import type { OverlayArrowProps } from "react-aria-components";
import { OverlayArrow as AriaOverlayArrow } from "react-aria-components";

type PopoverArrowProps = Omit<OverlayArrowProps, "children">;
function PopoverArrow(props: PopoverArrowProps, ref: Ref<HTMLDivElement>) {
  return (
    <AriaOverlayArrow {...props} ref={ref}>
      <svg width={12} height={12} viewBox="0 0 12 12">
        <path d="M0 0 L6 6 L12 0" />
      </svg>
    </AriaOverlayArrow>
  );
}

const _PopoverArrow = forwardRef(PopoverArrow);
export { _PopoverArrow as PopoverArrow };
export type { PopoverArrowProps };
