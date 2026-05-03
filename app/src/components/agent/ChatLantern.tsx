import { css, keyframes } from "@emotion/react";

import { useTheme } from "@phoenix/contexts";
import type { ProviderTheme } from "@phoenix/contexts";

const chatLanternBeforeRight = keyframes`
  0% {
    transform: translate3d(-14%, -14%, 0) scale(0.84);
    opacity: 0.25;
  }

  35% {
    transform: translate3d(-2%, -6%, 0) scale(0.98);
    opacity: 0.35;
  }

  62% {
    transform: translate3d(10%, 2%, 0) scale(1.18);
    opacity: 0.5;
  }

  100% {
    transform: translate3d(-14%, -14%, 0) scale(0.84);
    opacity: 0.25;
  }
`;

const chatLanternAfterLeft = keyframes`
  0% {
    transform: translate3d(-18%, -10%, 0) rotate(-10deg) scale(1.14);
    opacity: 0.15;
  }

  38% {
    transform: translate3d(-20%, -3%, 0) rotate(-2deg) scale(0.88);
    opacity: 0.25;
  }

  68% {
    transform: translate3d(14%, 20%, 0) rotate(6deg) scale(3);
    opacity: 0.4;
  }

  100% {
    transform: translate3d(-18%, -10%, 0) rotate(-10deg) scale(1.14);
    opacity: 0.15;
  }
`;

type LanternThemeStyle = {
  blendMode: "multiply" | "screen";
  beforeBackground: string;
  afterBackground: string;
};

const lanternThemeStyles: Record<ProviderTheme, LanternThemeStyle> = {
  dark: {
    blendMode: "screen",
    beforeBackground: `
      radial-gradient(
        ellipse at 38% 18%,
        rgba(242, 247, 255, 0.2) 0%,
        rgba(169, 191, 255, 0.09) 46%,
        rgba(158, 148, 255, 0) 84%
      )`,
    afterBackground: `
      radial-gradient(
        ellipse at 64% 16%,
        rgba(255, 247, 235, 0.18) 0%,
        rgba(255, 196, 170, 0.08) 44%,
        rgba(255, 164, 145, 0) 82%
      )`,
  },
  light: {
    blendMode: "multiply",
    beforeBackground: `
      radial-gradient(
        ellipse at 38% 18%,
        rgba(183, 192, 207, 0.28) 0%,
        rgba(140, 149, 170, 0.10) 46%,
        rgba(116, 119, 146, 0) 84%
      )`,
    afterBackground: `
      radial-gradient(
        ellipse at 64% 16%,
        rgba(144, 162, 192, 0.18) 0%,
        rgba(102, 122, 156, 0.07) 44%,
        rgba(87, 107, 141, 0) 82%
      )`,
  },
};

const chatLanternCSS = css`
  --chat-lantern-opacity-duration: 300ms;
  --chat-lantern-opacity-easing: ease-out;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: -64px;
  height: calc(100% + 64px);
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
  opacity: 0;
  transform: translate3d(0, 20px, 0) scale(0.985);
  filter: saturate(0.92);
  transition:
    opacity var(--chat-lantern-opacity-duration) var(--chat-lantern-opacity-easing),
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 420ms ease-out;

  &.chat-lantern--visible {
    --chat-lantern-opacity-duration: 560ms;
    --chat-lantern-opacity-easing: ease-in-out;
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: saturate(1);
  }

  &::before,
  &::after {
    content: "";
    position: absolute;
    top: 0;
    transform-origin: top center;
    border-radius: 999px;
    will-change: transform, opacity;
  }

  &::before {
    left: 50%;
    top: -120px;
    width: 170%;
    height: 380px;
    opacity: 0.4;
    transform-origin: top left;
    filter: blur(42px);
    animation: ${chatLanternBeforeRight} 18s ease-in-out infinite;
  }

  &::after {
    top: 150px;
    right: 60%;
    width: 250%;
    height: 300px;
    transform-origin: top right;
    opacity: 0.5;
    filter: blur(48px);
    animation: ${chatLanternAfterLeft} 24s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::before,
    &::after {
      animation: none;
      will-change: auto;
    }

    &::before {
      transform: translate3d(0, 14%, 0) scale(1);
      opacity: 0.2;
    }

    &::after {
      transform: translate3d(-10%, -10%, 0) rotate(-20deg) scale(2.14);
      opacity: 0.3;
    }

    transform: none;
    filter: none;
    transition: opacity var(--chat-lantern-opacity-duration) var(--chat-lantern-opacity-easing);

    &.chat-lantern--visible {
      transform: none;
      filter: none;
    }
  }
`;

function getLanternThemeCSS(theme: ProviderTheme) {
  const { blendMode, beforeBackground, afterBackground } =
    lanternThemeStyles[theme];

  return css`
    &::before,
    &::after {
      mix-blend-mode: ${blendMode};
    }

    &::before {
      background: ${beforeBackground};
    }

    &::after {
      background: ${afterBackground};
    }
  `;
}

export function ChatLantern({
  isVisible,
}: {
  isVisible: boolean;
}) {
  const { theme } = useTheme();

  return (
    <div
      css={[chatLanternCSS, getLanternThemeCSS(theme)]}
      className={isVisible ? "chat-lantern chat-lantern--visible" : "chat-lantern"}
      aria-hidden="true"
    />
  );
}