import React, { ReactNode, useState } from "react";
import { Link, NavLink as RRNavLink } from "react-router-dom";
import { css, Theme } from "@emotion/react";

import { Icon, Icons, Text } from "@arizeai/components";

import { useTheme } from "@phoenix/contexts";

import { Logo } from "./Logo";

const topNavCSS = css`
  padding: var(--px-spacing-med) var(--px-spacing-med) var(--px-spacing-med)
    12px;
  border-bottom: 1px solid var(--ac-global-color-grey-200);
  flex: none;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const sideNavCSS = css`
  padding: var(--px-spacing-lg) var(--px-spacing-med);
  flex: none;
  display: flex;
  flex-direction: column;
  background-color: var(--ac-global-color-grey-75);
  border-right: 1px solid var(--ac-global-color-grey-200);
  box-sizing: border-box;
  height: 100vh;
  position: fixed;
  width: var(--px-nav-collapsed-width);
  z-index: 1;
  transition:
    width 0.15s cubic-bezier(0, 0.57, 0.21, 0.99),
    box-shadow 0.15s cubic-bezier(0, 0.57, 0.21, 0.99);
  &[data-expanded="true"] {
    width: var(--px-nav-expanded-width);
    box-shadow: 0 0 30px 0 rgba(0, 0, 0, 0.2);
  }
`;

const navLinkCSS = css`
  width: 100%;
  color: var(--ac-global-text-color-500);
  background-color: transparent;
  border-radius: var(--ac-global-rounding-small);
  display: flex;
  flex-direction: row;
  align-items: center;
  overflow: hidden;
  transition:
    color 0.2s ease-in-out,
    background-color 0.2s ease-in-out;
  text-decoration: none;
  &.active {
    color: var(--ac-global-text-color-900);
    background-color: var(--ac-global-color-primary-300);
  }
  &:hover:not(.active) {
    color: var(--ac-global-text-color-900);
    background-color: var(--ac-global-color-grey-200);
  }
  & > .ac-icon-wrap {
    padding: var(--ac-global-dimension-size-50);
    display: inline-block;
  }
`;

const brandCSS = (theme: Theme) => css`
  color: var(--ac-global-text-color-900);
  font-size: ${theme.typography.sizes.large.fontSize}px;
  text-decoration: none;
  margin: 0 0 var(--px-spacing-lg) 0;
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

function ExternalLink(props: { href: string; icon: ReactNode; text: string }) {
  return (
    <a href={props.href} target="_blank" css={navLinkCSS} rel="noreferrer">
      {props.icon}
      <Text>{props.text}</Text>
    </a>
  );
}

export function GitHubLink() {
  return (
    <ExternalLink
      href="https://github.com/arize-ai/phoenix"
      icon={<Icon svg={<GitHubSVG />} />}
      text="Repository"
    />
  );
}

export function DocsLink() {
  return (
    <ExternalLink
      href="https://docs.arize.com/phoenix"
      icon={<Icon svg={<Icons.BookFilled />} />}
      text="Documentation"
    />
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      css={navLinkCSS}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="button--reset"
    >
      <Icon svg={isDark ? <Icons.MoonOutline /> : <Icons.SunOutline />} />
      <Text>{isDark ? "Dark" : "Light"}</Text>
    </button>
  );
}

export function Brand() {
  return (
    <Link to="/" css={brandCSS}>
      <Logo />
    </Link>
  );
}

export function TopNavbar({ children }: { children: ReactNode }) {
  return <nav css={topNavCSS}>{children}</nav>;
}

export function SideNavbar({ children }: { children: ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <nav
      data-expanded={isHovered}
      css={sideNavCSS}
      onMouseOver={() => {
        setIsHovered(true);
      }}
      onMouseOut={() => {
        setIsHovered(false);
      }}
    >
      {children}
    </nav>
  );
}

export function NavLink(props: { to: string; text: string; icon: ReactNode }) {
  return (
    <RRNavLink to={props.to} css={navLinkCSS}>
      {props.icon}
      <Text>{props.text}</Text>
    </RRNavLink>
  );
}
