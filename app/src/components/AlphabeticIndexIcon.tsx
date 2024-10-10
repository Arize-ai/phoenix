import React, { useMemo } from "react";
import { transparentize } from "polished";
import { css } from "@emotion/react";

import { useWordColor } from "@phoenix/hooks/useWordColor";

function indexToChar(index: number) {
  // Wrap around using modulo if index exceeds 'C'
  const charCode = 65 + (index % 3); // 'A' has ASCII code 65, 'B' is 66, 'C' is 67
  return String.fromCharCode(charCode);
}

export function AlphabeticIndexIcon({ index }: { index: number }) {
  const char = useMemo(() => indexToChar(index), [index]);
  const color = useWordColor(char);
  const backgroundColor = useMemo(() => transparentize(0.5, color), [color]);
  return (
    <div
      css={css`
        color: ${color};
        background-color: ${backgroundColor};
        width: 24px;
        height: 24px;
        border-radius: var(--ac-global-rounding-small);
      `}
    >
      {char}
    </div>
  );
}
