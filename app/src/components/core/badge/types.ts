import type { ReactNode } from "react";

import type {
  ComponentSize,
  StylableProps,
} from "@phoenix/components/core/types";

export type BadgeVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type BadgeOverflowMode = "wrap" | "truncate";

export interface BadgeProps extends StylableProps {
  /**
   * The content to display in the badge.
   */
  children: ReactNode;
  /**
   * The variant controls the badge color.
   * @default 'default'
   */
  variant?: BadgeVariant;
  /**
   * The size of the badge.
   * @default 'S'
   */
  size?: ComponentSize;
  /**
   * Controls text behavior when content exceeds available space.
   * @default 'wrap'
   */
  overflowMode?: BadgeOverflowMode;
}
