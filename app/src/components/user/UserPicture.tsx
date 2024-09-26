import React, { useMemo } from "react";
import { darken } from "polished";
import { css } from "@emotion/react";

import { useWordColor } from "@phoenix/hooks/useWordColor";

export function UserPicture({
  name,
  profilePictureUrl,
  size = 75,
}: {
  name: string;
  profilePictureUrl: string | null;
  /**
   * The diameter of the profile picture
   **/
  size?: number;
}) {
  const firstLetter = name.length ? name[0].toUpperCase() : "?";
  const wordColor = useWordColor(name);
  const gradientColors: [string, string] = useMemo(() => {
    const wordColorTransparent = darken(0.3, wordColor);
    return [wordColor, wordColorTransparent];
  }, [wordColor]);
  return (
    <div
      css={css`
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        font-size: ${Math.floor(size / 2)}px;
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
        overflow: hidden;
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}
    >
      {profilePictureUrl ? <img src={profilePictureUrl} /> : firstLetter}
    </div>
  );
}
