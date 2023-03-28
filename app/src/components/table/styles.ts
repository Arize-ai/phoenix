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
