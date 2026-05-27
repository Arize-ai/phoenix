import type { ReactNode } from "react";
import type { ButtonProps as AriaButtonProps } from "react-aria-components";

import type {
  SizingProps,
  StylableProps,
  Variant,
} from "@phoenix/components/core/types";

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
  /**
   * Optional explanation shown in a tooltip when the button is disabled.
   * When provided alongside `isDisabled`, the button remains focusable and
   * hoverable so the tooltip can be reached, while press handlers stay inert.
   */
  disabledReason?: ReactNode;
  /**
   * Tooltip placement for `disabledReason`.
   * @default: 'top'
   */
  disabledReasonPlacement?: "top" | "bottom" | "left" | "right";
  /**
   * Tooltip offset for `disabledReason`.
   * @default: 8
   */
  disabledReasonOffset?: number;
}
