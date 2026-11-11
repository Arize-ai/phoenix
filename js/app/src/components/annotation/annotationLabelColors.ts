import { useSequentialChartColors } from "@phoenix/components/chart/colors";
import { useWordColor } from "@phoenix/hooks/useWordColor";

import type { AnnotationOptimizationConfig } from "./optimizationUtils";

/**
 * A neutral accent for an annotation's first label where the annotation's
 * word color would mislead: the word color is a hash of the name, so a
 * "correct" label can land on red. Indigo is no status hue, reads on both
 * themes' backgrounds, and stands apart from the grays the other labels get.
 */
export const ANNOTATION_LABEL_ACCENT_COLOR = "var(--global-color-indigo-800)";

/**
 * The palette an annotation's labels are drawn from: the annotation's own
 * word color for its first (best) label, then grays for the rest, so the
 * label that matters most carries the annotation's identity and the others
 * read as its complement. Pass `primaryColor` to draw the first label in
 * another color, e.g. {@link ANNOTATION_LABEL_ACCENT_COLOR}.
 */
export function useAnnotationLabelColors(
  annotationName: string,
  { primaryColor }: { primaryColor?: string } = {}
): string[] {
  const chartColors = useSequentialChartColors();
  const wordColor = useWordColor(annotationName);
  return [
    primaryColor ?? wordColor,
    chartColors.gray300,
    chartColors.gray400,
    chartColors.gray500,
    chartColors.gray600,
  ];
}

/**
 * Stretches a label palette to cover `labelCount` labels by cycling its
 * colors after the first, so a later label never wraps back onto the first
 * label's color and reads as the leading one.
 */
export function extendAnnotationLabelColors(
  colors: string[],
  labelCount: number
): string[] {
  const [firstColor, ...restColors] = colors;
  if (restColors.length === 0 || labelCount <= colors.length) {
    return colors;
  }
  return [
    firstColor,
    ...Array.from(
      { length: labelCount - 1 },
      (_, index) => restColors[index % restColors.length]
    ),
  ];
}

/**
 * The labels of a categorical annotation config in the order their colors
 * are assigned: best score first for the config's optimization direction,
 * ties (and unscored labels) in config order. Null when the config does not
 * enumerate its labels.
 */
export function getAnnotationLabelOrder(
  annotationConfig: AnnotationOptimizationConfig | undefined
): string[] | null {
  if (
    !annotationConfig ||
    annotationConfig.annotationType !== "CATEGORICAL" ||
    !annotationConfig.values
  ) {
    return null;
  }
  return [...annotationConfig.values]
    .sort((a, b) => {
      const aScore = a.score ?? 0;
      const bScore = b.score ?? 0;
      return (
        (annotationConfig.optimizationDirection === "MAXIMIZE" ? -1 : 1) *
        (aScore - bScore)
      );
    })
    .map((value) => value.label)
    .filter((label): label is string => label != null);
}

/**
 * A stable color for one of an annotation's labels.
 *
 * For a categorical config the color follows the label's place in
 * {@link getAnnotationLabelOrder}, so a label keeps its color wherever the
 * annotation is shown, whatever order or subset of labels a summary holds.
 * Without one (or for a label the config does not list) it falls back to the
 * label's index in the caller's list.
 *
 * @param colors - the palette, typically from {@link useAnnotationLabelColors}
 * @param fallbackIndex - the label's index in the caller's list
 * @param label - the label to color
 * @param annotationConfig - the annotation's config, when known
 */
export function getAnnotationLabelColor(
  colors: string[],
  fallbackIndex: number,
  label: string,
  annotationConfig?: AnnotationOptimizationConfig
): string {
  const order = getAnnotationLabelOrder(annotationConfig);
  const index = order?.indexOf(label) ?? -1;
  return colors[
    index === -1 ? fallbackIndex % colors.length : index % colors.length
  ];
}
