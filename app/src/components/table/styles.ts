import { css, Theme } from "@emotion/react";

export const tableCSS = (theme: Theme) => css`
  font-size: ${theme.typography.sizes.medium.fontSize}px;
  width: 100%;
  border-collapse: collapse;
  thead {
    background-color: ${theme.colors.gray600};
    position: sticky;
    top: 0;
    tr {
      th {
        padding: ${theme.spacing.margin4}px ${theme.spacing.margin16}px;
        position: relative;
        text-align: left;
        .cursor-pointer {
          cursor: pointer;
        }
        .sort-icon {
          margin-left: ${theme.spacing.margin4}px;
          font-size: ${theme.typography.sizes.small.fontSize}px;
          vertical-align: middle;
          display: inline-block;
        }
        &:hover .resizer {
          background: ${theme.colors.gray300};
        }
        div.resizer {
          display: inline-block;

          width: 2px;
          height: 100%;
          position: absolute;
          right: 0;
          top: 0;
          cursor: grab;
          z-index: 1;
          touch-action: none;
          &.isResizing,
          &:hover {
            background: var(--px-light-blue-color);
          }
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

export const selectableTableCSS = (theme: Theme) =>
  css(
    tableCSS(theme),
    css`
      tbody:not(.is-empty) {
        tr {
          cursor: pointer;
        }
      }
    `
  );

export const paginationCSS = (theme: Theme) => css`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: ${theme.spacing.margin8}px;
  gap: ${theme.spacing.margin4}px;
  border-top: 1px solid ${theme.colors.gray500};
`;
