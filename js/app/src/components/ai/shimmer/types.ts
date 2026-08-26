import type { CSSProperties, HTMLAttributes } from "react";

import type { TextElementType, Weight } from "../../core/content/types";
import type { DOMProps } from "../../core/types/dom";
import type { TextSize } from "../../core/types/sizing";
import type { TextColorValue } from "../../core/types/style";

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
   * The base text color of the shimmer.
   * @default "text-700"
   */
  color?: TextColorValue;
  /**
   * The font style.
   * @default "normal"
   */
  fontStyle?: CSSProperties["fontStyle"];
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
