import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { PxiShaderGlyph } from "./PxiShaderGlyph";

const heroCSS = css`
  position: relative;
  box-sizing: border-box;
  width: min(100%, 640px);
  padding-top: var(--hero-padding-top, var(--global-dimension-size-4000));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--global-dimension-size-150);

  @media (max-height: 960px) {
    --hero-glyph-size: 380px;
    --hero-padding-top: var(--global-dimension-size-3600);
  }

  @media (max-height: 840px) {
    --hero-glyph-size: 300px;
    --hero-padding-top: var(--global-dimension-size-2500);
  }

  @media (max-height: 720px) {
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
  width: var(--hero-glyph-size, 420px);
  height: var(--hero-glyph-size, 420px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;

  @media (max-height: 720px) {
    position: static;
    transform: none;
    width: 104px;
    height: 104px;
  }

  @media (max-height: 720px) {
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
  max-width: var(--global-dimensions-size-4000);

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
  return (
    <div css={heroCSS} className="chat__empty-hero">
      <div css={glyphCSS} className="chat__empty-glyph">
        <PxiShaderGlyph size={420} />
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
