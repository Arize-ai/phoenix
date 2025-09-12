import { forwardRef } from "react";
import {
  ColorSwatchPicker as AriaColorSwatchPicker,
  type ColorSwatchPickerProps as AriaColorSwatchPickerProps,
} from "react-aria-components";

export interface ColorSwatchPickerProps extends AriaColorSwatchPickerProps {}

export const ColorSwatchPicker = forwardRef<
  HTMLDivElement,
  ColorSwatchPickerProps
>((props: ColorSwatchPickerProps, ref) => {
  return <AriaColorSwatchPicker {...props} ref={ref} />;
});

ColorSwatchPicker.displayName = "ColorSwatchPicker";
