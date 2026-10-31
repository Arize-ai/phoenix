import type { Ref } from "react";

import { ColorSwatch } from "@phoenix/components/color/ColorSwatch";
import type { ButtonProps } from "@phoenix/components/core/button";
import { Button } from "@phoenix/components/core/button";
import { SelectChevronUpDownIcon } from "@phoenix/components/core/icon";

export type ComparisonPickerButtonProps = Omit<
  ButtonProps,
  "leadingVisual" | "trailingVisual"
> & {
  /**
   * The color that identifies this side of the comparison wherever the
   * comparison is rendered
   */
  color: string;
};

/**
 * The trigger for a picker that chooses one side of a comparison, led by the
 * color swatch that identifies that side
 */
export function ComparisonPickerButton({
  ref,
  color,
  size = "S",
  ...props
}: ComparisonPickerButtonProps & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <Button
      {...props}
      ref={ref}
      size={size}
      leadingVisual={<ColorSwatch color={color} shape="circle" />}
      trailingVisual={<SelectChevronUpDownIcon />}
    />
  );
}
