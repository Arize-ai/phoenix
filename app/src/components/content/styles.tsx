import { css } from "@emotion/react";

export const textBaseCSS = css`
  margin: 0;
  font-weight: 400;
  &[data-size="XS"] {
    font-size: var(--ac-global-font-size-xs);
    line-height: var(--ac-global-line-height-xs);
  }
  &[data-size="S"] {
    font-size: var(--ac-global-font-size-s);
    line-height: var(--ac-global-line-height-s);
  }
  &[data-size="M"] {
    font-size: var(--ac-global-font-size-m);
    line-height: var(--ac-global-line-height-m);
  }
  &[data-size="L"] {
    font-size: var(--ac-global-font-size-l);
    line-height: var(--ac-global-line-height-l);
  }
  &[data-size="XL"] {
    font-size: var(--ac-global-font-size-xl);
    line-height: var(--ac-global-line-height-xl);
  }
  &[data-weight="heavy"] {
    font-weight: 600;
  }
`;

export const headingBaseCSS = css`
  color: var(--ac-global-text-color-900);
  &[data-level="1"] {
    font-size: var(--ac-global-font-size-xl);
    line-height: var(--ac-global-line-height-xl);
  }
  &[data-level="2"] {
    font-size: var(--ac-global-font-size-l);
    line-height: var(--ac-global-line-height-l);
  }
  &[data-level="3"] {
    font-size: var(--ac-global-font-size-m);
    line-height: var(--ac-global-line-height-m);
  }
  &[data-level="4"] {
    font-size: var(--ac-global-font-size-s);
    line-height: var(--ac-global-line-height-s);
  }
  &[data-level="5"] {
    font-size: var(--ac-global-font-size-xs);
    line-height: var(--ac-global-line-height-xs);
  }
  &[data-level="6"] {
    font-size: var(--ac-global-font-size-xxs);
    line-height: var(--ac-global-line-height-xxs);
  }
`;
