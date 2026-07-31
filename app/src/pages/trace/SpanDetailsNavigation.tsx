import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

const spanDetailsNavigationCSS = css`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex: none;
  height: calc(
    var(--global-line-height-s) + var(--global-dimension-size-100) +
      var(--global-dimension-size-100) + var(--global-border-size-thin)
  );
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  .span-details-navigation__list {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    padding: 0;
    overflow-x: auto;
    list-style: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .span-details-navigation__item {
    flex: none;
  }

  .span-details-navigation__link {
    display: flex;
    position: relative;
    align-items: center;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    border-radius: var(--global-rounding-small);
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    text-decoration: none;
    white-space: nowrap;
    outline: none;

    &:hover {
      color: var(--global-text-color-900);
      background: var(--global-color-primary-50);
    }

    &:focus-visible {
      color: var(--global-text-color-900);
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: calc(-1 * var(--focus-ring-offset));
    }
  }

  .span-details-navigation__placeholder {
    box-sizing: content-box;
    display: flex;
    align-items: center;
    height: var(--global-line-height-s);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  }

  & > button {
    flex: none;
    margin-right: var(--global-dimension-size-100);
  }
`;

export function SpanDetailsNavigation({
  children,
  label,
  trailingAction,
}: PropsWithChildren<{
  label: string;
  trailingAction?: ReactNode;
}>) {
  return (
    <nav
      className="span-details-navigation"
      css={spanDetailsNavigationCSS}
      aria-label={label}
    >
      <ul className="span-details-navigation__list">{children}</ul>
      {trailingAction}
    </nav>
  );
}
