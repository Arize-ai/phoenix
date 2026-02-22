import type { ReactNode } from "react";
import type { ButtonProps as AriaButtonProps } from "react-aria-components";

import type {
  SizingProps,
  StylableProps,
  Variant,
} from "@phoenix/components/types";

type ButtonVariant = Exclude<Variant, "info">;

export interface ButtonProps
  extends AriaButtonProps, SizingProps, StylableProps {
  /**
   * A leading visual element before the text. Note visual elements alone should not be used as the only content of a button.
   */
  leadingVisual?: ReactNode;
  /**
   * A trailing visual element after the text. Note visual elements alone should not be used as the only content of a button.
   */
  trailingVisual?: ReactNode;
  /**
   * The variant of the button
   * @default: 'default'
   */
  variant?: ButtonVariant;
}
