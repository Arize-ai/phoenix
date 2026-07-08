import type { Ref } from "react";
import {
  ColorField as AriaColorField,
  type ColorFieldProps as AriaColorFieldProps,
} from "react-aria-components";

export interface ColorFieldProps extends AriaColorFieldProps {}

export function ColorField({
  ref,
  ...props
}: ColorFieldProps & { ref?: Ref<HTMLDivElement> }) {
  return <AriaColorField {...props} ref={ref} />;
}

ColorField.displayName = "ColorField";
