import { PropsWithChildren, ReactNode, useMemo } from "react";
import { Pressable } from "react-aria-components";
import { Link, NavLink as RRNavLink } from "react-router";
import { css } from "@emotion/react";

import {
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { GitHubStarCount } from "@phoenix/components/nav/GitHubStarCount";
import { type ProviderThemeMode, useTheme, useViewer } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";

import { Logo, LogoText } from "./Logo";

const topNavCSS = css`
  padding: var(--ac-global-dimension-static-size-100);
  background-color: var(--ac-global-color-grey-100);
  flex: none;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: var(--ac-global-dimension-static-size-100);
`;

const sideNavCSS = css`
  padding: var(--ac-global-dimension-static-size-200)
    var(--ac-global-dimension-static-size-100);
  background-color: var(--ac-global-color-grey-100);
  flex: none;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100vh;
  width: var(--px-nav-collapsed-width);
  transition: width 0.15s cubic-bezier(0, 0.57, 0.21, 0.99);
  &[data-expanded="true"] {
    width: var(--px-nav-expanded-width);
  }
  &[data-expanded="false"] {
    .brand-text-wrap {
      opacity: 0;
    }
  }
`;

const navLinkCSS = css`
  width: 100%;
  color: var(--ac-global-color-grey-500);
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
  cursor: pointer;

  &.active {
    color: var(--ac-global-text-color-900);
    background-color: var(--ac-global-color-grey-200);
  }
  &:hover:not(.active) {
    color: var(--ac-global-text-color-900);
    background-color: var(--ac-global-color-grey-200);
  }
  & > .ac-icon-wrap {
    padding: var(--ac-global-dimension-size-100);
    display: inline-block;
  }
  .ac-text {
    padding-inline-start: var(--ac-global-dimension-size-50);
    padding-inline-end: var(--ac-global-dimension-size-100);
    white-space: nowrap;
  }
`;

const brandCSS = css`
  color: var(--ac-global-text-color-900);
  font-size: var(--ac-global-font-size-xl);
  text-decoration: none;
  margin: 0 0 var(--ac-global-dimension-static-size-200) 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--ac-global-dimension-static-size-150);
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

export function DocsLink({ isExpanded }: { isExpanded: boolean }) {
  return (
    <ExternalLink
      href="https://arize.com/docs/phoenix"
      leadingVisual={<Icon svg={<Icons.BookOutline />} />}
      text="Documentation"
      isExpanded={isExpanded}
    />
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

export function ThemeToggle({ isExpanded }: { isExpanded: boolean }) {
  const { themeMode, setThemeMode } = useTheme();
  const { nextThemeMode, themeModeText, themeIcon } = useMemo(() => {
    const themeModes: ProviderThemeMode[] = ["dark", "light", "system"];
    const currentThemeModeIndex = themeModes.indexOf(themeMode);
    const nextThemeModeIndex = (currentThemeModeIndex + 1) % themeModes.length;
    const nextThemeMode = themeModes[nextThemeModeIndex];
    let themeIcon: ReactNode;
    switch (themeMode) {
      case "light":
        themeIcon = <Icons.SunOutline />;
        break;
      case "dark":
        themeIcon = <Icons.MoonOutline />;
        break;
      case "system":
        themeIcon = <Icons.HalfMoonHallSunOutline />;
        break;
      default:
        assertUnreachable(themeMode);
    }
    const capitalizedThemeMode =
      themeMode.charAt(0).toUpperCase() + themeMode.slice(1);
    return {
      nextThemeMode,
      themeIcon,
      themeModeText: capitalizedThemeMode,
    };
  }, [themeMode]);

  return (
    <TooltipTrigger delay={0} isDisabled={isExpanded}>
      <Pressable>
        <button
          css={navLinkCSS}
          onClick={() => setThemeMode(nextThemeMode)}
          className="button--reset"
        >
          <Icon svg={themeIcon} />
          <Text>{themeModeText}</Text>
        </button>
      </Pressable>
      <Tooltip placement="right" offset={10}>
        {themeModeText}
      </Tooltip>
    </TooltipTrigger>
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

export function TopNavbar({ children }: { children: ReactNode }) {
  return <nav css={topNavCSS}>{children}</nav>;
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
  isExpanded: boolean;
}) {
  return (
    <TooltipTrigger delay={0} isDisabled={props.isExpanded}>
      <Pressable>
        <div role="button">
          <RRNavLink to={props.to} css={navLinkCSS}>
            {props.leadingVisual}
            <Text>{props.text}</Text>
          </RRNavLink>
        </div>
      </Pressable>
      <Tooltip placement="right" offset={10}>
        {props.text}
      </Tooltip>
    </TooltipTrigger>
  );
}

export function NavButton(props: {
  text: string;
  leadingVisual: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="button--reset" css={navLinkCSS} onClick={props.onClick}>
      {props.leadingVisual}
      <Text>{props.text}</Text>
    </button>
  );
}

export const ManagementLink = ({ isExpanded }: { isExpanded: boolean }) => {
  const { viewer } = useViewer();

  if (viewer?.isManagementUser && window.Config.managementUrl) {
    return (
      <li key="management">
        <ExternalLink
          href={window.Config.managementUrl}
          leadingVisual={<Icon svg={<Icons.Server />} />}
          text="Management Console"
          replaceTab
          isExpanded={isExpanded}
        />
      </li>
    );
  }
  return null;
};
