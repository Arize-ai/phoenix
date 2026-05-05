import { css } from "@emotion/react";
import { useEffect, useState, type ReactNode } from "react";

import { PxiShaderGlyph } from "./PxiShaderGlyph";

const LARGE_GLYPH_SIZE = 420;
const MEDIUM_GLYPH_SIZE = 380;
const SMALL_GLYPH_SIZE = 300;
const COMPACT_GLYPH_SIZE = 200;

const MEDIUM_HEIGHT_BREAKPOINT = 960;
const SMALL_HEIGHT_BREAKPOINT = 840;
const COMPACT_HEIGHT_BREAKPOINT = 720;

function getHeroGlyphSize(viewportHeight: number) {
  if (viewportHeight <= COMPACT_HEIGHT_BREAKPOINT) {
    return COMPACT_GLYPH_SIZE;
  }

  if (viewportHeight <= SMALL_HEIGHT_BREAKPOINT) {
    return SMALL_GLYPH_SIZE;
  }

  if (viewportHeight <= MEDIUM_HEIGHT_BREAKPOINT) {
    return MEDIUM_GLYPH_SIZE;
  }

  return LARGE_GLYPH_SIZE;
}

const heroCSS = css`
  position: relative;
  box-sizing: border-box;
  width: min(100%, 640px);
  padding-top: var(--hero-padding-top, var(--global-dimension-size-4000));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--global-dimension-size-150);

  @media (max-height: ${MEDIUM_HEIGHT_BREAKPOINT}px) {
    --hero-glyph-size: ${MEDIUM_GLYPH_SIZE}px;
    --hero-padding-top: var(--global-dimension-size-3600);
  }

  @media (max-height: ${SMALL_HEIGHT_BREAKPOINT}px) {
    --hero-glyph-size: ${SMALL_GLYPH_SIZE}px;
    --hero-padding-top: var(--global-dimension-size-2500);
  }

  @media (max-height: ${COMPACT_HEIGHT_BREAKPOINT}px) {
    --hero-padding-top: 0px;
    --hero-glyph-top-offset: 0px;
    width: 450px;
    flex-direction: row;
    justify-content: space-evenly;
    gap: var(--global-dimension-size-200);
  }

  @media (max-height: 570px) {
    display: none;
  }

  @container (max-width: 479px) {
    width: auto;
  }
`;

const glyphCSS = css`
  position: absolute;
  top: var(--hero-glyph-top-offset, calc(-1 * var(--global-dimension-size-700)));
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 1;
  width: var(--hero-glyph-size, ${LARGE_GLYPH_SIZE}px);
  height: var(--hero-glyph-size, ${LARGE_GLYPH_SIZE}px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;

  @media (max-height: ${COMPACT_HEIGHT_BREAKPOINT}px) {
    position: static;
    transform: none;
    width: ${COMPACT_GLYPH_SIZE / 2}px;
    height: ${COMPACT_GLYPH_SIZE / 2}px;
  }

  @media (max-height: ${COMPACT_HEIGHT_BREAKPOINT}px) {
    @container (max-width: 479px) {
      display: none;
    }
  }
`;

const copyCSS = css`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--global-dimension-size-100);
  max-width: var(--global-dimension-size-4000);

  @media (max-height: 720px) {
    position: static;
  }
`;

const titleCSS = css`
  margin: 0;
  font-size: var(--global-font-size-l);
  font-weight: var(--px-font-weight-heavy);
  color: var(--global-text-color-900);
  text-align: center;

  @media (prefers-reduced-motion: reduce) {
    transform: none;
  }
`;

const subtextCSS = css`
  margin: 0;
  text-align: center;
  color: var(--global-text-color-500);
  line-height: var(--global-line-height-m);
  white-space: pre-line;

  @media (prefers-reduced-motion: reduce) {
    transform: none;
  }
`;

const DEFAULT_SUBTEXT =
  "Ask questions about Phoenix, get help with \n tracing, datasets, evaluations, and more.";

export function ChatEmptyShaderHero({
  subtext = DEFAULT_SUBTEXT,
}: {
  subtext?: ReactNode;
}) {
  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window === "undefined") {
      return Number.POSITIVE_INFINITY;
    }

    return window.innerHeight;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  const glyphSize = getHeroGlyphSize(viewportHeight);

  return (
    <div css={heroCSS} className="chat__empty-hero">
      <div css={glyphCSS} className="chat__empty-glyph">
        <PxiShaderGlyph size={glyphSize} />
      </div>
      <div css={copyCSS} className="chat__empty-copy">
        <h2 css={titleCSS} className="chat__empty-title">
          Meet PXI, your Phoenix assistant
        </h2>
        <p css={subtextCSS} className="chat__empty-subtext">
          {subtext}
        </p>
      </div>
    </div>
  );
}
