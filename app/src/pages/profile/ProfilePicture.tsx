import React, { useMemo } from "react";
import { darken } from "polished";
import { css } from "@emotion/react";

import { useWordColor } from "@phoenix/hooks/useWordColor";

export function ProfilePicture({ name }: { name: string }) {
  const firstLetter = name.length ? name[0].toUpperCase() : "?";
  const wordColor = useWordColor(name);
  const gradientColors: [string, string] = useMemo(() => {
    const wordColorTransparent = darken(0.3, wordColor);
    return [wordColor, wordColorTransparent];
  }, [wordColor]);
  return (
    <div
      css={css`
        width: 75px;
        height: 75px;
        border-radius: 50%;
        font-size: 36px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border: 1px solid var(--ac-global-color-grey-300);
        color: white;
        background: linear-gradient(
          120deg,
          ${gradientColors[0]},
          ${gradientColors[1]}
        );
      `}
    >
      {firstLetter}
    </div>
  );
}
