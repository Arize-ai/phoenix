import type { HTMLAttributes } from "react";

import type { TextElementType, Weight } from "../../core/content/types";
import type { DOMProps } from "../../core/types/dom";
import type { TextSize } from "../../core/types/sizing";

export interface ShimmerProps extends HTMLAttributes<HTMLElement>, DOMProps {
  /**
   * The text content to display with the shimmer effect.
   * Must be a string so the gradient size can be calculated from text length.
   */
  children: string;
  /**
   * The HTML element type to render.
   * @default "p"
   */
  elementType?: TextElementType;
  /**
   * The text size.
   * @default "S"
   */
  size?: TextSize;
  /**
   * The font weight.
   * @default "normal"
   */
  weight?: Weight;
  /**
   * Animation cycle duration in seconds.
   * @default 2
   */
  duration?: number;
  /**
   * Gradient width multiplier relative to text length.
   * Higher values create a wider shimmer gradient.
   * @default 2
   */
  spread?: number;
  /**
   * Optional className for custom styling.
   */
  className?: string;
}
