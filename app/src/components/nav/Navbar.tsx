import React, { ReactNode } from "react";
import { css, Theme } from "@emotion/react";

const navCSS = (theme: Theme) => css`
  padding: ${theme.spacing.padding8}px;
  border-bottom: 1px solid ${theme.colors.gray600};
`;

const brandCSS = (theme: Theme) =>
  css`
    color: ${theme.textColors.white70};
    text-decoration: none;
  `;

export function Brand() {
  return (
    <a href="/" css={brandCSS}>
      Phoenix
    </a>
  );
}

export function Navbar({ children }: { children: ReactNode }) {
  return <nav css={navCSS}>{children}</nav>;
}
