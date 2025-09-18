import { CheckboxProps as AriaCheckboxProps } from "react-aria-components";

export interface CheckboxProps extends AriaCheckboxProps {
  /*
   * Whether to apply hover styles to the checkbox
   */
  isHovered?: boolean;
}
