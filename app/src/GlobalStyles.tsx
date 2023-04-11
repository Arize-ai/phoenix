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
          margin-block-start: 0;
        }

        /* this css class is added to html via modernizr @see modernizr.js */
        .no-hiddenscroll {
          /* Works on Firefox */
          * {
            scrollbar-width: thin;
            scrollbar-color: ${theme.colors.gray300} ${theme.colors.gray500};
          }

          /* Works on Chrome, Edge, and Safari */
          *::-webkit-scrollbar {
            width: 14px;
          }

          *::-webkit-scrollbar-track {
            background: ${theme.colors.gray700};
          }

          *::-webkit-scrollbar-thumb {
            background-color: ${theme.colors.gray900};
            border-radius: 8px;
            border: 1px solid ${theme.colors.gray300};
          }
        }

        :root {
          --px-blue-color: ${theme.colors.arizeBlue};
          --px-light-blue-color: ${theme.colors.arizeLightBlue};

          --px-primary-color: #9efcfd;
          --px-primary-color--transparent: rgb(158, 252, 253, 0.2);
          --px-reference-color: #baa1f9;
          --px-reference-color--transparent: #baa1f982;

          --px-flex-gap-sm: ${theme.spacing.margin4}px;
          --px-flex-gap-sm: ${theme.spacing.margin8}px;

          --px-border-color-500: ${theme.colors.gray500};
          --px-border-color-300: ${theme.colors.gray300};

          --px-section-background-color: ${theme.colors.gray500};
          --px-item-background-color: ${theme.colors.gray800};

          --px-spacing-sm: ${theme.spacing.padding4}px;
          --px-spacing-med: ${theme.spacing.padding8}px;
          --px-spacing-lg: ${theme.spacing.padding16}px;

          --px-border-radius-med: ${theme.borderRadius.medium}px;

          --px-font-size-sm: ${theme.typography.sizes.small.fontSize}px;
          --px-font-size-med: ${theme.typography.sizes.medium.fontSize}px;
          --px-font-size-lg: ${theme.typography.sizes.large.fontSize}px;

          --px-gradient-bar-height: 8px;
        }
      `}
    />
  );
}
