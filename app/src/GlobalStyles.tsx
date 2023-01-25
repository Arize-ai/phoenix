import React from "react";
import { Global, css } from "@emotion/react";

export function GlobalStyles() {
  return (
    <Global
      styles={(theme) => css`
        body {
          background-color: ${theme.colors.gray800};
          color: ${theme.textColors.white90};
          font-family: "Roboto";
          font-size: ${theme.typography.sizes.medium.fontSize}px;
          margin: 0;
        }
      `}
    />
  );
}
