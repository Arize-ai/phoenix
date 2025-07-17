import { useMemo } from "react";
import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts";
import { useWordColor } from "@phoenix/hooks/useWordColor";

export function UserPicture({
  name = "system",
  profilePictureUrl,
  size = 75,
}: {
  name?: string;
  profilePictureUrl?: string | null;
  /**
   * The diameter of the profile picture
   **/
  size?: number;
}) {
  const firstLetter = name.length ? name[0].toUpperCase() : "?";
  const wordColor = useWordColor(name);
  const { theme } = useTheme();

  const styles = useMemo(() => {
    return css`
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      font-size: ${Math.floor(size / 2)}px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      flex: none;
      overflow: hidden;
      --ac-internal-avatar-color: ${wordColor};

      &[data-theme="light"] {
        background: var(--ac-internal-avatar-color);
        border: 1px solid
          lch(from var(--ac-internal-avatar-color) calc(l * infinity) c h / 0.3);
        color: lch(
          from var(--ac-internal-avatar-color) calc((50 - l) * infinity) 0 0
        );
      }

      &[data-theme="dark"] {
        --scoped-avatar-dark-bg: lch(
          from var(--ac-internal-avatar-color) calc(l * 0.7) c h
        );
        background: linear-gradient(
          120deg,
          var(--scoped-avatar-dark-bg),
          lch(from var(--scoped-avatar-dark-bg) calc(l * 0.6) c h)
        );
        border: 1px solid
          lch(from var(--scoped-avatar-dark-bg) calc(l * infinity) c h / 0.2);
        color: lch(from var(--scoped-avatar-dark-bg) calc(l * infinity) c h);
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    `;
  }, [size, wordColor]);

  return (
    <div css={styles} data-theme={theme}>
      {profilePictureUrl ? <img src={profilePictureUrl} /> : firstLetter}
    </div>
  );
}
