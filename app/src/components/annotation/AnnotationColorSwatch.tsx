import React from "react";
import { css } from "@emotion/react";

import { useWordColor } from "@phoenix/hooks/useWordColor";

export function AnnotationColorSwatch({
  annotationName,
}: {
  annotationName: string;
}) {
  const color = useWordColor(annotationName);
  return (
    <span
      css={css`
        background-color: ${color};
        display: inline-block;
        width: 0.6rem;
        height: 0.6rem;
        border-radius: 2px;
      `}
    />
  );
}
