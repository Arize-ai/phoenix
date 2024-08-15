import React from "react";
import { css } from "@emotion/react";

export function ColorSwatch({ color }: { color: string }) {
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
