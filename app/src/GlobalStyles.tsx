import React from "react";
import { css, Global } from "@emotion/react";

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

          --px-flex-gap-sm: ${theme.spacing.margin4}px;
          --px-flex-gap-sm: ${theme.spacing.margin8}px;

          --px-border-color-500: ${theme.colors.gray500};

          --px-section-background-color: ${theme.colors.gray500};

          --px-spacing-sm: ${theme.spacing.padding4}px;
          --px-spacing-med: ${theme.spacing.padding8}px;
          --px-spacing-lg: ${theme.spacing.padding16}px;
        }
      `}
    />
  );
}
