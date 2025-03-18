import { css } from "@emotion/react";

import { SeverityLevel } from "../types";

export const baseSeverityCSS = css`
  backdrop-filter: blur(10px);
`;

const generateSeverityCSS = (semanticColor: SeverityLevel) => {
  const colorPrefix = `--ac-global-color-${semanticColor}`;
  return css(
    baseSeverityCSS,
    css`
      border: 1px solid var(${colorPrefix});
      background-color: var(${colorPrefix}-700);
      color: var(--ac-global-static-color-white-900);
    `
  );
};

export const warningCSS = generateSeverityCSS("warning");
export const infoCSS = generateSeverityCSS("info");
export const dangerCSS = generateSeverityCSS("danger");
export const successCSS = generateSeverityCSS("success");
