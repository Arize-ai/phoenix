import React, { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";
import { css, Theme } from "@emotion/react";

import { Icons } from "@arizeai/components";

import { Logo } from "./Logo";

const navCSS = (theme: Theme) => css`
  padding: ${theme.spacing.padding8}px ${theme.spacing.padding16}px;
  border-bottom: 1px solid ${theme.colors.gray500};
  background-color: ${theme.colors.gray900};
  flex: none;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const brandCSS = (theme: Theme) => css`
  color: ${theme.textColors.text - 900};
  font-size: ${theme.typography.sizes.large.fontSize}px;
  text-decoration: none;
  svg {
    margin-right: ${theme.spacing.margin16}px;
  }
`;

const GitHubSVG = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
  >
    <g data-name="Layer 2">
      <rect width="24" height="24" transform="rotate(180 12 12)" opacity="0" />
      <path
        d="M12 1A10.89 10.89 0 0 0 1 11.77 10.79 10.79 0 0 0 8.52 22c.55.1.75-.23.75-.52v-1.83c-3.06.65-3.71-1.44-3.71-1.44a2.86 2.86 0 0 0-1.22-1.58c-1-.66.08-.65.08-.65a2.31 2.31 0 0 1 1.68 1.11 2.37 2.37 0 0 0 3.2.89 2.33 2.33 0 0 1 .7-1.44c-2.44-.27-5-1.19-5-5.32a4.15 4.15 0 0 1 1.11-2.91 3.78 3.78 0 0 1 .11-2.84s.93-.29 3 1.1a10.68 10.68 0 0 1 5.5 0c2.1-1.39 3-1.1 3-1.1a3.78 3.78 0 0 1 .11 2.84A4.15 4.15 0 0 1 19 11.2c0 4.14-2.58 5.05-5 5.32a2.5 2.5 0 0 1 .75 2v2.95c0 .35.2.63.75.52A10.8 10.8 0 0 0 23 11.77 10.89 10.89 0 0 0 12 1"
        data-name="github"
      />
    </g>
  </svg>
);

function IconLink(props: PropsWithChildren<{ href: string }>) {
  return (
    <a
      href={props.href}
      target="_blank"
      css={(theme) => css`
        padding: ${theme.spacing.padding4}px;
        width: 20px;
        height: 20px;
        display: block;
        svg {
          fill: ${theme.textColors.white50};
          transition: fill 0.2s ease-in-out;
        }
        &:hover svg {
          fill: ${theme.textColors.text - 900};
        }
      `}
      aria-label="GitHub"
      rel="noreferrer"
    >
      {props.children}
    </a>
  );
}

export function GitHubLink() {
  return (
    <IconLink href="https://github.com/arize-ai/phoenix">
      <GitHubSVG />
    </IconLink>
  );
}

export function DocsLink() {
  return (
    <IconLink href="https://docs.arize.com/phoenix">
      <Icons.BookFilled />
    </IconLink>
  );
}

export function Brand() {
  return (
    <Link to="/" css={brandCSS}>
      <Logo />
    </Link>
  );
}

export function Navbar({ children }: { children: ReactNode }) {
  return <nav css={navCSS}>{children}</nav>;
}
