import React from "react";
import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
  Link,
} from "react-aria-components";
import { css } from "@emotion/react";

export interface BreadcrumbsProps {
  children: React.ReactNode;
  onAction?: (index: string | number) => void;
}

export interface BreadcrumbProps {
  children: React.ReactNode;
  href?: string;
  onPress?: () => void;
  isDisabled?: boolean;
  isCurrent?: boolean;
}

const breadcrumbsCSS = css`
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-size-50);
  font-size: var(--ac-global-dimension-font-size-75);
  color: var(--ac-global-text-color-900);
  list-style: none;
  margin: 0;
  padding: 0;
`;

const breadcrumbCSS = css`
  display: flex;
  align-items: center;

  &:not(:last-child)::after {
    content: ">";
    margin-left: var(--ac-global-dimension-size-50);
    color: var(--ac-global-text-color-700);
    font-weight: normal;
  }
`;

const linkCSS = css`
  color: var(--ac-global-text-color-700);
  text-decoration: none;
  outline: none;
  border-radius: var(--ac-global-rounding-small);
  padding: var(--ac-global-dimension-size-25) var(--ac-global-dimension-size-50);
  margin: calc(-1 * var(--ac-global-dimension-size-25))
    calc(-1 * var(--ac-global-dimension-size-50));

  &[data-hovered] {
    color: var(--ac-global-text-color-900);
    background-color: var(--ac-global-color-grey-200);
  }

  &[data-current] {
    color: var(--ac-global-text-color-900);
    font-weight: 600;
    cursor: default;
  }

  &[data-focus-visible] {
    box-shadow: inset 0 0 0 2px var(--ac-global-color-primary);
  }
`;

// Simple wrapper that passes through to React Aria Components
export const Breadcrumbs = ({
  children,
  onAction,
  ...props
}: BreadcrumbsProps) => {
  return (
    <AriaBreadcrumbs css={breadcrumbsCSS} onAction={onAction} {...props}>
      {children}
    </AriaBreadcrumbs>
  );
};

// Simple wrapper for Breadcrumb with Link inside
export const Breadcrumb = ({
  children,
  href,
  onPress,
  isDisabled,
  isCurrent,
  ...props
}: BreadcrumbProps) => {
  return (
    <AriaBreadcrumb css={breadcrumbCSS} {...props}>
      <Link
        css={linkCSS}
        href={href}
        onPress={onPress}
        isDisabled={isDisabled}
        aria-current={isCurrent ? "page" : undefined}
      >
        {children}
      </Link>
    </AriaBreadcrumb>
  );
};
