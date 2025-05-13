import { useMemo } from "react";
import { schemeSet2 } from "d3-scale-chromatic";
import { transparentize } from "polished";
import { css } from "@emotion/react";

function indexToChar(index: number) {
  // Wrap around using modulo if index exceeds 'C'
  const charCode = 65 + index; // 'A' has ASCII code 65, 'B' is 66, 'C' is 67
  return String.fromCharCode(charCode);
}

export function AlphabeticIndexIcon({ index }: { index: number }) {
  const char = useMemo(() => indexToChar(index), [index]);
  const color = useMemo(() => schemeSet2[index % 8], [index]);
  const backgroundColor = useMemo(() => transparentize(0.8, color), [color]);
  return (
    <div
      css={css`
        color: ${color};
        background-color: ${backgroundColor};
        width: 24px;
        height: 24px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: var(--ac-global-rounding-small);
      `}
    >
      {char}
    </div>
  );
}
