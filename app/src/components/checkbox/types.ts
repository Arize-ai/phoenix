import { CheckboxProps as AriaCheckboxProps } from "react-aria-components";

export interface CheckboxProps extends AriaCheckboxProps {
  /*
   * Whether to apply hover styles to the checkbox when it's not already hovered.
   * Useful when you want a wrapper around the checkbox to create a larger hover target.
   * @default false
   */
  isHovered?: boolean;
}
