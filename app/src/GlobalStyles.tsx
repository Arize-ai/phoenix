import React from "react";
import { css,Global } from "@emotion/react";

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
          #root,
          #root > div[data-overlay-container="true"] {
            height: 100vh;
          }
        }

        /* Remove list styling */
        ul {
          display: block;
          list-style-type: none;
          margin-block-start: none;
          margin-block-end: 0;
          padding-inline-start: 0;
        }

        :root {
          --px-blue-color: ${theme.colors.arizeBlue};
          --px-light-blue-color: ${theme.colors.arizeLightBlue};

          --px-primary-color: #9efcfd;
          --px-primary-color--transparent: rgb(158, 252, 253, 0.2);
          --px-reference-color: #baa1f9;
        }
      `}
    />
  );
}
