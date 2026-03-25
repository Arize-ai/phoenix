import { css } from "@emotion/react";
import type { Ref } from "react";
import {
  ColorSwatchPicker as AriaColorSwatchPicker,
  type ColorSwatchPickerProps as AriaColorSwatchPickerProps,
} from "react-aria-components";

export interface ColorSwatchPickerProps extends AriaColorSwatchPickerProps {}

const colorSwatchPickerCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  flex-wrap: wrap;

  .react-aria-ColorSwatchPickerItem {
    position: relative;
    width: fit-content;
    height: fit-content;
    forced-color-adjust: none;
    display: inline-flex;

    &[data-selected]::after {
      content: "";
      position: absolute;
      inset: 0;
      border: 2px solid var(--global-text-color-900);
      border-radius: inherit;
    }
  }
`;

export function ColorSwatchPicker({
  ref,
  ...props
}: ColorSwatchPickerProps & { ref?: Ref<HTMLDivElement> }) {
  return (
    <AriaColorSwatchPicker css={colorSwatchPickerCSS} {...props} ref={ref} />
  );
}

ColorSwatchPicker.displayName = "ColorSwatchPicker";
