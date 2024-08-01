import React from "react";

import { ColorSwatch } from "@phoenix/components/ColorSwatch";
import { useWordColor } from "@phoenix/hooks/useWordColor";

export function AnnotationColorSwatch({
  annotationName,
}: {
  annotationName: string;
}) {
  const color = useWordColor(annotationName);
  return <ColorSwatch color={color} />;
}
