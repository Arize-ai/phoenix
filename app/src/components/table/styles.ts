import { css, Theme } from "@emotion/react";

export const tableCSS = (theme: Theme) => css`
  font-size: ${theme.typography.sizes.medium.fontSize}px;
  width: 100%;
  border-collapse: collapse;
  thead {
    background-color: ${theme.colors.gray600};
    tr {
      th {
        padding: ${theme.spacing.margin4}px ${theme.spacing.margin16}px;
        text-align: left;
        .sort-icon {
          margin-left: ${theme.spacing.margin4}px;
          display: inline-block;
        }
        .resizer {
          display: inline-block;

          width: 2px;
          height: 100%;
          position: absolute;
          right: 0;
          top: 0;
          transform: translateX(50%);
          z-index: 1;
          touch-action: none;
          &.isResizing {
            background: var(--px-light-blue-color);
          }
        }
        &:hover .resizer {
          background: ${theme.colors.gray300};
        }
      }
    }
  }
  tbody:not(.is-empty) {
    tr {
      &:nth-of-type(even) {
        background-color: ${theme.colors.gray700};
      }
      &:hover {
        background-color: ${theme.colors.gray600};
      }
      & > td {
        padding: ${theme.spacing.margin8}px ${theme.spacing.margin16}px;
      }
    }
  }
`;
