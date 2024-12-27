import React from "react";
import { css, Global } from "@emotion/react";

export function GlobalStyles() {
  return (
    <Global
      styles={(theme) => css`
        body {
          background-color: var(--ac-global-color-grey-75);
          color: var(--ac-global-text-color-900);
          font-family: "Roboto";
          font-size: ${theme.typography.sizes.medium.fontSize}px;
          margin: 0;
          overflow: hidden;
          #root,
          #root > div[data-overlay-container="true"],
          #root > div[data-overlay-container="true"] > .ac-theme {
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

        /* A reset style for buttons */
        .button--reset {
          background: none;
          border: none;
          padding: 0;
        }
        /* this css class is added to html via modernizr @see modernizr.js */
        .no-hiddenscroll {
          /* Works on Firefox */
          * {
            scrollbar-width: thin;
            scrollbar-color: var(--ac-global-color-grey-300)
              var(--ac-global-color-grey-400);
          }

          /* Works on Chrome, Edge, and Safari */
          *::-webkit-scrollbar {
            width: 14px;
          }

          *::-webkit-scrollbar-track {
            background: var(--ac-global-color-grey-100);
          }

          *::-webkit-scrollbar-thumb {
            background-color: var(--ac-global-color-grey-75);
            border-radius: 8px;
            border: 1px solid var(--ac-global-color-grey-300);
          }
        }

        :root {
          --px-blue-color: ${theme.colors.arizeBlue};

          --px-section-background-color: #2f353d;

          /** The color of shadows on menus etc. */
          --px-overlay-shadow-color: rgba(0, 0, 0, 0.4);

          /* An item is a typically something in a list */
          --px-item-background-color: #1d2126;
          --px-item-border-color: #282e35;

          --px-font-weight-heavy: 600;

          --px-gradient-bar-height: 8px;

          --px-nav-collapsed-width: 45px;
          --px-nav-expanded-width: 200px;

          /* Text */
          --ac-global-font-size-xs: 12px;
          --ac-global-font-size-s: 14px;
          --ac-global-font-size-m: 16px;
          --ac-global-font-size-l: 18px;
          --ac-global-font-size-xl: 24px;
          --ac-global-font-size-xxl: 32px;

          --ac-global-line-height-xs: 16px;
          --ac-global-line-height-s: 20px;
          --ac-global-line-height-m: 24px;
          --ac-global-line-height-l: 28px;
          --ac-global-line-height-xl: 40px;
        }

        .ac-theme--dark {
          --px-primary-color: #9efcfd;
          --px-primary-color--transparent: rgb(158, 252, 253, 0.2);
          --px-reference-color: #baa1f9;
          --px-reference-color--transparent: #baa1f982;
          --px-corpus-color: #92969c;
          --px-corpus-color--transparent: #92969c63;
        }
        .ac-theme--light {
          --px-primary-color: #00add0;
          --px-primary-color--transparent: rgba(0, 173, 208, 0.2);
          --px-reference-color: #4500d9;
          --px-reference-color--transparent: rgba(69, 0, 217, 0.2);
          --px-corpus-color: #92969c;
          --px-corpus-color--transparent: #92969c63;
        }
      `}
    />
  );
}
