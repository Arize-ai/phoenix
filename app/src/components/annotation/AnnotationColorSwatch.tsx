import { ColorSwatch } from "@phoenix/components/color/ColorSwatch";
import type { SizingProps } from "@phoenix/components/core/types";
import { useWordColor } from "@phoenix/hooks/useWordColor";

export function AnnotationColorSwatch({
  annotationName,
  ...sizingProps
}: {
  annotationName: string;
} & SizingProps) {
  const color = useWordColor(annotationName);
  return <ColorSwatch color={color} {...sizingProps} />;
}
