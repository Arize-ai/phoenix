import { forwardRef } from "react";
import {
  ColorField as AriaColorField,
  type ColorFieldProps as AriaColorFieldProps,
} from "react-aria-components";

export interface ColorFieldProps extends AriaColorFieldProps {}

export const ColorField = forwardRef<HTMLDivElement, ColorFieldProps>(
  (props: ColorFieldProps, ref) => {
    return <AriaColorField {...props} ref={ref} />;
  }
);

ColorField.displayName = "ColorField";
