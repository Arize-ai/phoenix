import React, { useMemo } from "react";
import { interpolateSinebow } from "d3-scale-chromatic";
import { css } from "@emotion/react";

export function AnnotationColorSwatch({
  annotationName,
}: {
  annotationName: string;
}) {
  const color = useMemo(() => {
    // Derive a color from the label first character
    const charCode = annotationName.charCodeAt(0);
    return interpolateSinebow((charCode % 26) / 26);
  }, [annotationName]);
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
