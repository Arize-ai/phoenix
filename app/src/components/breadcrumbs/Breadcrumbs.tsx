import React, { ReactNode } from "react";
import { useBreadcrumbItem, useBreadcrumbs } from "react-aria";
import { css } from "@emotion/react";

export interface BreadcrumbsProps {
  children: ReactNode;
  onAction?: (index: string | number) => void;
  className?: string;
}

interface BreadcrumbItemProps {
  children: ReactNode;
  isCurrent?: boolean;
  onPress?: () => void;
}

const breadcrumbsCSS = css`
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-static-size-100);
  font-size: var(--ac-global-dimension-font-size-75);
  color: var(--ac-global-text-color-700);

  ol {
    display: flex;
    align-items: center;
    gap: var(--ac-global-dimension-static-size-100);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--ac-global-dimension-static-size-100);
  }

  li:not(:last-child)::after {
    content: "/";
    color: var(--ac-global-text-color-500);
    font-weight: normal;
  }

  button,
  span {
    background: none;
    border: none;
    padding: 0;
    color: var(--ac-global-text-color-700);
    cursor: pointer;
    text-decoration: none;
    font-size: inherit;
    font-family: inherit;

    &:hover:not([aria-current]) {
      color: var(--ac-global-text-color-900);
      text-decoration: underline;
    }

    &:focus {
      outline: 2px solid var(--ac-global-color-primary);
      outline-offset: 2px;
      border-radius: 2px;
    }
  }

  [aria-current="page"] {
    color: var(--ac-global-text-color-900);
    font-weight: 500;
    cursor: default;
  }
`;

function BreadcrumbItem({ children, isCurrent, onPress }: BreadcrumbItemProps) {
  const ref = React.useRef<HTMLLIElement>(null);
  const { itemProps } = useBreadcrumbItem(
    {
      children,
      isCurrent,
      onPress,
      elementType: onPress ? "button" : "span",
    },
    ref
  );

  return (
    <li {...itemProps} ref={ref}>
      {onPress ? (
        <button type="button" onClick={onPress}>
          {children}
        </button>
      ) : (
        <span aria-current="page">{children}</span>
      )}
    </li>
  );
}

export function Breadcrumbs({
  children,
  onAction,
  className,
}: BreadcrumbsProps) {
  const childrenArray = React.Children.toArray(children);
  const { navProps } = useBreadcrumbs({});

  return (
    <nav {...navProps} css={breadcrumbsCSS} className={className}>
      <ol>
        {childrenArray.map((child, index) => {
          const isLast = index === childrenArray.length - 1;
          const childContent = React.isValidElement(child)
            ? child.props.children
            : child;

          return (
            <BreadcrumbItem
              key={index}
              isCurrent={isLast}
              onPress={!isLast ? () => onAction?.(index) : undefined}
            >
              {childContent}
            </BreadcrumbItem>
          );
        })}
      </ol>
    </nav>
  );
}
