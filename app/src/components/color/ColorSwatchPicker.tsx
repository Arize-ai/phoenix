import { forwardRef } from "react";
import {
  ColorSwatchPicker as AriaColorSwatchPicker,
  type ColorSwatchPickerProps as AriaColorSwatchPickerProps,
} from "react-aria-components";
import { css } from "@emotion/react";

export type ColorSwatchPickerProps = AriaColorSwatchPickerProps;

const colorSwatchPickerCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--ac-global-dimension-size-100);
  flex-wrap: wrap;

  .react-aria-ColorSwatchPickerItem {
    position: relative;
    outline: none;
    width: fit-content;
    height: fit-content;
    forced-color-adjust: none;
    display: inline-flex;

    &[data-focus-visible] {
      outline: 2px solid var(--focus-ring-color);
      outline-offset: 2px;
    }

    &[data-selected]::after {
      content: "";
      position: absolute;
      inset: 0;
      border: 2px solid var(--ac-global-text-color-900);
      outline-offset: -4px;
      border-radius: inherit;
    }
  }
`;

export const ColorSwatchPicker = forwardRef<
  HTMLDivElement,
  ColorSwatchPickerProps
>((props: ColorSwatchPickerProps, ref) => {
  return (
    <AriaColorSwatchPicker css={colorSwatchPickerCSS} {...props} ref={ref} />
  );
});

ColorSwatchPicker.displayName = "ColorSwatchPicker";
