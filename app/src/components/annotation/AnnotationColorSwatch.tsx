import React from "react";

import { useWordColor } from "@phoenix/hooks/useWordColor";

import { ColorSwatch } from "../ColorSwatch";

export function AnnotationColorSwatch({
  annotationName,
}: {
  annotationName: string;
}) {
  const color = useWordColor(annotationName);
  return <ColorSwatch color={color} />;
}
