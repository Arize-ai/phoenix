import { css } from "@emotion/react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { PxiShaderGlyph } from "./PxiShaderGlyph";

const LARGE_GLYPH_SIZE = 420;
const MEDIUM_GLYPH_SIZE = 380;
const SMALL_GLYPH_SIZE = 300;
const COMPACT_GLYPH_SIZE = 220;
const COMPACT_ROW_GLYPH_SIZE = COMPACT_GLYPH_SIZE / 2;
const COMPACT_ROW_HERO_WIDTH = 450;

const MEDIUM_HEIGHT_BREAKPOINT = 960;
const SMALL_HEIGHT_BREAKPOINT = 840;
const COMPACT_HEIGHT_BREAKPOINT = 720;
const HIDE_HERO_HEIGHT_BREAKPOINT = 570;
const NARROW_WIDTH_BREAKPOINT = 479;
const MEDIUM_WIDTH_BREAKPOINT = 560;
const NARROW_GLYPH_SIZE = 220;
const COMPACT_HERO_PADDING_TOP = 176;
const SMALL_HERO_PADDING_TOP = COMPACT_GLYPH_SIZE;
const MEDIUM_HERO_PADDING_TOP = 288;
const LARGE_HERO_PADDING_TOP = 320;
const COMPACT_GLYPH_TOP_OFFSET = -40;
const SMALL_GLYPH_TOP_OFFSET = -48;
const DEFAULT_GLYPH_TOP_OFFSET = -56;

type HeroContainerSize = {
  width: number;
  height: number;
};

function getHeroGlyphSize({ height, width }: HeroContainerSize) {
  let glyphSize = LARGE_GLYPH_SIZE;

  if (height <= COMPACT_HEIGHT_BREAKPOINT) {
    glyphSize = COMPACT_GLYPH_SIZE;
  } else if (height <= SMALL_HEIGHT_BREAKPOINT) {
    glyphSize = SMALL_GLYPH_SIZE;
  } else if (height <= MEDIUM_HEIGHT_BREAKPOINT) {
    glyphSize = MEDIUM_GLYPH_SIZE;
  }

  if (width <= NARROW_WIDTH_BREAKPOINT) {
    return Math.min(glyphSize, NARROW_GLYPH_SIZE);
  }

  if (width <= MEDIUM_WIDTH_BREAKPOINT) {
    return Math.min(glyphSize, SMALL_GLYPH_SIZE);
  }

  return glyphSize;
}

function getHeroPaddingTop(glyphSize: number) {
  if (glyphSize <= COMPACT_GLYPH_SIZE) {
    return COMPACT_HERO_PADDING_TOP;
  }

  if (glyphSize <= SMALL_GLYPH_SIZE) {
    return SMALL_HERO_PADDING_TOP;
  }

  if (glyphSize <= MEDIUM_GLYPH_SIZE) {
    return MEDIUM_HERO_PADDING_TOP;
  }

  return LARGE_HERO_PADDING_TOP;
}

function getHeroGlyphTopOffset(glyphSize: number) {
  if (glyphSize <= COMPACT_GLYPH_SIZE) {
    return COMPACT_GLYPH_TOP_OFFSET;
  }

  if (glyphSize <= SMALL_GLYPH_SIZE) {
    return SMALL_GLYPH_TOP_OFFSET;
  }

  return DEFAULT_GLYPH_TOP_OFFSET;
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
    padding-top: 0;
    width: ${COMPACT_ROW_HERO_WIDTH}px;
    flex-direction: row;
    justify-content: space-evenly;
    gap: var(--global-dimension-size-200);
  }

  @media (max-height: ${HIDE_HERO_HEIGHT_BREAKPOINT}px) {
    display: none;
  }

  @container (max-width: 479px) {
    width: auto;
  }
`;

const glyphCSS = css`
  position: absolute;
  top: var(
    --hero-glyph-top-offset,
    calc(-1 * var(--global-dimension-size-700))
  );
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
    width: ${COMPACT_ROW_GLYPH_SIZE}px;
    height: ${COMPACT_ROW_GLYPH_SIZE}px;
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
  const heroRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<HeroContainerSize>(() => {
    if (typeof window === "undefined") {
      return {
        width: Number.POSITIVE_INFINITY,
        height: Number.POSITIVE_INFINITY,
      };
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const updateContainerSize = () => {
      const measuredElement =
        heroRef.current?.closest(".chat__scroll") ?? heroRef.current;
      const rect = measuredElement?.getBoundingClientRect();

      setContainerSize({
        width: rect?.width || window.innerWidth,
        height: rect?.height || window.innerHeight,
      });
    };

    updateContainerSize();

    const measuredElement =
      heroRef.current?.closest(".chat__scroll") ?? heroRef.current;
    const observer =
      measuredElement && typeof ResizeObserver === "function"
        ? new ResizeObserver(updateContainerSize)
        : null;

    if (observer && measuredElement) {
      observer.observe(measuredElement);
    }
    window.addEventListener("resize", updateContainerSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateContainerSize);
    };
  }, []);

  const glyphSize = getHeroGlyphSize(containerSize);
  const paddingTop = getHeroPaddingTop(glyphSize);
  const glyphTopOffset = getHeroGlyphTopOffset(glyphSize);
  const heroStyle: CSSProperties & Record<`--${string}`, string> = {
    "--hero-glyph-size": `${glyphSize}px`,
    "--hero-padding-top": `${paddingTop}px`,
    "--hero-glyph-top-offset": `${glyphTopOffset}px`,
  };

  return (
    <div
      ref={heroRef}
      css={heroCSS}
      className="chat__empty-hero"
      style={heroStyle}
    >
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
