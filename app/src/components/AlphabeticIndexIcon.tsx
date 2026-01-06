import { useMemo } from "react";
import { schemeSet2 } from "d3-scale-chromatic";
import { transparentize } from "polished";
import { css } from "@emotion/react";

import { Size } from "@phoenix/components/types/sizing";
function indexToChar(index: number) {
  // Wrap around using modulo if index exceeds 'C'
  const charCode = 65 + index; // 'A' has ASCII code 65, 'B' is 66, 'C' is 67
  return String.fromCharCode(charCode);
}

export type AlphabeticIndexIconProps = {
  size?: Extract<Size, "XS" | "S" | "M">;
  index: number;
};

const iconBaseCSS = css`
  border-radius: var(--ac-global-rounding-small);
  border: 1px solid
    var(--alphabetic-index-icon-border-color, var(--ac-global-color-grey-300));
  background-color: var(
    --alphabetic-index-icon-background-color,
    var(--ac-global-color-grey-100)
  );
  color: var(--alphabetic-index-icon-color, var(--ac-global-text-color-900));
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  &[data-size="XS"] {
    width: var(--ac-global-dimension-static-size-250);
    height: var(--ac-global-dimension-static-size-250);
    font-size: var(--ac-global-font-size-xs);
  }
  &[data-size="S"] {
    width: var(--ac-global-button-height-s);
    height: var(--ac-global-button-height-s);
    font-size: var(--ac-global-font-size-s);
  }
  &[data-size="M"] {
    width: var(--ac-global-button-height-m);
    height: var(--ac-global-button-height-m);
    font-size: var(--ac-global-font-size-m);
  }
`;
export function AlphabeticIndexIcon({
  index,
  size = "S",
}: AlphabeticIndexIconProps) {
  const char = useMemo(() => indexToChar(index), [index]);
  const color = useMemo(() => schemeSet2[index % 8], [index]);
  const backgroundColor = useMemo(() => transparentize(0.8, color), [color]);
  return (
    <div
      data-size={size}
      css={css(
        iconBaseCSS,
        css`
          --alphabetic-index-icon-color: ${color};
          --alphabetic-index-icon-background-color: ${backgroundColor};
          --alphabetic-index-icon-border-color: ${color};
        `
      )}
    >
      {char}
    </div>
  );
}
