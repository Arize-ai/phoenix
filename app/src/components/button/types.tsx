import { ReactNode } from "react";
import { ButtonProps as AriaButtonProps } from "react-aria-components";

import { SizingProps, StylableProps, Variant } from "@phoenix/components/types";

type ButtonVariant = Exclude<Variant, "info">;

export interface ButtonProps
  extends AriaButtonProps,
    SizingProps,
    StylableProps {
  /**
   * An optional prefixed icon for the button
   */
  icon?: ReactNode;
  /**
   * The variant of the button
   * @default: 'default'
   */
  variant?: ButtonVariant;
}
