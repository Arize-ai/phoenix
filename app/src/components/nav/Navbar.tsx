import React, { ReactNode } from "react";
import { css, Theme } from "@emotion/react";

const navCSS = (theme: Theme) => css`
  padding: ${theme.spacing.padding16}px;
  border-bottom: 1px solid ${theme.colors.gray500};
  background-color: ${theme.colors.gray900};
`;

const brandCSS = (theme: Theme) =>
  css`
    color: ${theme.textColors.white90};
    text-decoration: none;
    display: flex;
    flex-direction: row;
    svg {
      margin-right: ${theme.spacing.margin8}px;
    }
  `;

const BrandSVG = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 27 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13.5 24L0.0766047 0.750003L26.9234 0.75L13.5 24Z"
      fill="url(#paint0_linear_139_3946)"
    />
    <defs>
      <linearGradient
        id="paint0_linear_139_3946"
        x1="26.2239"
        y1="6.40834"
        x2="7.2602"
        y2="-4.23741"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#5742D8" />
        <stop offset="1" stopColor="#B7D5F0" />
      </linearGradient>
    </defs>
  </svg>
);

export function Brand() {
  return (
    <a href="/" css={brandCSS}>
      <BrandSVG />
      Phoenix
    </a>
  );
}

export function Navbar({ children }: { children: ReactNode }) {
  return <nav css={navCSS}>{children}</nav>;
}
