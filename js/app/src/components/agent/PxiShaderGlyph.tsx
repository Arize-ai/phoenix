import { css } from "@emotion/react";
import { useEffect, useState } from "react";

import { useTheme } from "@phoenix/contexts";
import type { ProviderTheme } from "@phoenix/contexts";

import {
  PxiShaderGlyphDark,
  type PxiShaderGlyphDarkProps,
} from "./PxiShaderGlyphDark";
import { PxiShaderGlyphLight } from "./PxiShaderGlyphLight";

export type PxiShaderGlyphProps = PxiShaderGlyphDarkProps;

const themeSwapFadeCSS = css`
  will-change: opacity, transform;
`;

const THEME_SWAP_DELAY_MS = 300;
const THEME_SWAP_FADE_MS = 800;

export function PxiShaderGlyph(props: PxiShaderGlyphProps) {
  const { theme } = useTheme();
  const [revealedTheme, setRevealedTheme] = useState<ProviderTheme | null>(
    null
  );
  const [isHiddenForPageTransition, setIsHiddenForPageTransition] =
    useState(false);
  const isVisible = revealedTheme === theme;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRevealedTheme(theme);
    }, THEME_SWAP_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [theme]);

  // Required bugfix for chrome on macos:
  // This listens for reload signals and stops the shader, otherwise
  // chrome wants to render it as a white box during reload
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const hideShader = () => {
      setIsHiddenForPageTransition(true);
    };

    const showShader = () => {
      setIsHiddenForPageTransition(false);
    };

    window.addEventListener("beforeunload", hideShader, { capture: true });
    window.addEventListener("pagehide", hideShader, { capture: true });
    window.addEventListener("pageshow", showShader);

    return () => {
      window.removeEventListener("beforeunload", hideShader, { capture: true });
      window.removeEventListener("pagehide", hideShader, { capture: true });
      window.removeEventListener("pageshow", showShader);
    };
  }, []);

  return (
    <div
      css={themeSwapFadeCSS}
      style={{
        opacity: isHiddenForPageTransition ? 0 : isVisible ? 1 : 0,
        transform: isVisible
          ? "translateY(0) scale(1)"
          : "translateY(6px) scale(0.98)",
        transition: isVisible
          ? `opacity ${THEME_SWAP_FADE_MS * 0.7}ms ease-out, transform ${THEME_SWAP_FADE_MS}ms cubic-bezier(0.34, 1.4, 0.64, 1)`
          : "none",
      }}
    >
      {theme === "light" ? (
        <PxiShaderGlyphLight {...props} />
      ) : (
        <PxiShaderGlyphDark {...props} />
      )}
    </div>
  );
}
