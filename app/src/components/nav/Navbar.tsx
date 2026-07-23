import { css } from "@emotion/react";
import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { Pressable } from "react-aria-components";
import { Link, NavLink as RRNavLink } from "react-router";

import {
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { hoverRevealCSS } from "@phoenix/components/core/styles";
import { GitHubStarCount } from "@phoenix/components/nav/GitHubStarCount";

import { Logo, LogoText } from "./Logo";

const topNavCSS = css`
  --top-nav-right-inset: 0px;
  padding: var(--global-dimension-size-100);
  padding-right: calc(
    var(--global-dimension-size-200) + var(--top-nav-right-inset)
  );
  background-color: var(--global-color-gray-100);
  flex: none;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: var(--global-dimension-size-100);

  /* Clip the PXI button's decorative glow without creating a scroll
     container or horizontal scrollbar in the surrounding layout panel. */
  overflow-x: clip;

  /* The breadcrumb trail (an <ol> from the Breadcrumbs component) is the
     nav's designated shrinking region: give the whole chain a min-width so
     crumb links can compress to their ellipsis and right-aligned controls
     (page actions, the PXI button) stay visible when the nav narrows —
     e.g. beside a detail drawer or docked assistant panel. */
  & > ol {
    flex: 0 1 auto;
    min-width: 0;

    .breadcrumb,
    .breadcrumb > div {
      min-width: 0;
    }
  }

  .copy-action-menu__button {
    ${hoverRevealCSS}
    transition: none;
  }
  &:hover .copy-action-menu__button,
  .copy-action-menu__button[data-pressed],
  .copy-action-menu__button[data-copied] {
    opacity: 1;
    transition: opacity 0.15s ease-in-out;
  }
`;

const sideNavCSS = css`
  padding: var(--global-dimension-size-200) var(--global-dimension-size-100);
  background-color: var(--global-color-gray-100);
  flex: none;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100vh;
  width: var(--nav-collapsed-width);
  transition: width 0.15s cubic-bezier(0, 0.57, 0.21, 0.99);
  &[data-expanded="true"] {
    width: var(--nav-expanded-width);
  }
  &[data-expanded="false"] {
    .brand-text-wrap {
      opacity: 0;
    }
  }
`;

export const navLinkCSS = css`
  --nav-link-icon-size: calc(
    var(--nav-collapsed-width) - var(--global-dimension-size-200)
  );

  width: 100%;
  min-height: var(--nav-link-icon-size);
  color: var(--global-color-gray-500);
  background-color: transparent;
  border-radius: var(--global-rounding-small);
  display: flex;
  flex-direction: row;
  align-items: center;
  overflow: hidden;
  transition:
    color 0.2s ease-in-out,
    background-color 0.2s ease-in-out;
  text-decoration: none;
  cursor: pointer;

  &.active {
    color: var(--global-text-color-900);
    background-color: var(--global-color-gray-200);
  }
  &:hover:not(.active) {
    color: var(--global-text-color-900);
    background-color: var(--global-color-gray-200);
  }
  & > .icon-wrap {
    box-sizing: border-box;
    width: var(--nav-link-icon-size);
    height: var(--nav-link-icon-size);
    flex: 0 0 var(--nav-link-icon-size);
    padding: var(--global-dimension-size-100);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .text {
    padding-inline-start: var(--global-dimension-size-50);
    padding-inline-end: var(--global-dimension-size-100);
    white-space: nowrap;
    flex: 1;
    text-align: start;
  }
  .counter {
    margin-inline-end: var(--global-dimension-size-100);
  }
`;

const brandCSS = css`
  color: var(--global-text-color-900);
  font-size: var(--global-font-size-xl);
  text-decoration: none;
  margin: 0 0 var(--global-dimension-size-200) 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-150);
  overflow: hidden;
  & > * {
    flex: none;
  }
  .brand-text-wrap {
    opacity: 1;
    transition: all 0.8s ease-in-out;
    display: flex;
    flex-direction: row;
    align-items: center;
  }
`;

function ExternalLink(props: {
  href: string;
  leadingVisual: ReactNode;
  trailingVisual?: ReactNode;
  text: string;
  replaceTab?: boolean;
  isExpanded: boolean;
}) {
  return (
    <TooltipTrigger delay={0} isDisabled={props.isExpanded}>
      <Pressable>
        <a
          href={props.href}
          target={props.replaceTab ? undefined : "_blank"}
          css={navLinkCSS}
          rel="noreferrer"
          role="button"
        >
          {props.leadingVisual}
          <Text>{props.text}</Text>
          {props.trailingVisual}
        </a>
      </Pressable>
      <Tooltip placement="right" offset={10}>
        {props.text}
      </Tooltip>
    </TooltipTrigger>
  );
}

export function GitHubLink({ isExpanded }: { isExpanded: boolean }) {
  return (
    <ExternalLink
      href="https://github.com/Arize-ai/phoenix"
      leadingVisual={<Icon svg={<Icons.GitHub />} />}
      trailingVisual={<GitHubStarCount />}
      text="Star on GitHub"
      isExpanded={isExpanded}
    />
  );
}

export function Brand() {
  return (
    <Link
      to="/"
      css={brandCSS}
      title={`version: ${window.Config.platformVersion}`}
    >
      <Logo />
      <div className="brand-text-wrap">
        <LogoText className="brand-text" />
      </div>
    </Link>
  );
}

type TopNavbarStyle = CSSProperties & {
  "--top-nav-right-inset": string;
};

export function TopNavbar({
  children,
  rightInset = 0,
}: {
  children: ReactNode;
  rightInset?: number;
}) {
  const style: TopNavbarStyle = {
    "--top-nav-right-inset": `${rightInset}px`,
  };
  return (
    <nav css={topNavCSS} style={style}>
      {children}
    </nav>
  );
}

export function SideNavbar({
  children,
  isExpanded,
}: PropsWithChildren<{ isExpanded: boolean }>) {
  return (
    <nav data-expanded={isExpanded} css={sideNavCSS}>
      {children}
    </nav>
  );
}

export function NavLink(props: {
  to: string;
  text: string;
  leadingVisual: ReactNode;
  trailingVisual?: ReactNode;
  isExpanded: boolean;
}) {
  return (
    <TooltipTrigger delay={0} isDisabled={props.isExpanded}>
      <Pressable>
        <RRNavLink to={props.to} css={navLinkCSS}>
          {props.leadingVisual}
          <Text>{props.text}</Text>
          {props.trailingVisual}
        </RRNavLink>
      </Pressable>
      <Tooltip placement="right" offset={10}>
        {props.text}
      </Tooltip>
    </TooltipTrigger>
  );
}
