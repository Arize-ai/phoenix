import { ColorSwatch } from "@phoenix/components/ColorSwatch";
import { SizingProps } from "@phoenix/components/types";
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
