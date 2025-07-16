import React, { ReactNode } from "react";
import { css } from "@emotion/react";

export interface BreadcrumbsProps {
  children: ReactNode;
  onAction?: (index: string | number) => void;
  className?: string;
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

  button {
    background: none;
    border: none;
    padding: 0;
    color: var(--ac-global-text-color-700);
    cursor: pointer;
    text-decoration: none;
    font-size: inherit;
    font-family: inherit;
    
    &:hover {
      color: var(--ac-global-text-color-900);
      text-decoration: underline;
    }
    
    &:focus {
      outline: 2px solid var(--ac-global-color-primary);
      outline-offset: 2px;
      border-radius: 2px;
    }
  }

  .breadcrumb-current {
    color: var(--ac-global-text-color-900);
    font-weight: 500;
  }
`;

export function Breadcrumbs({ children, onAction, className }: BreadcrumbsProps) {
  const childrenArray = React.Children.toArray(children);

  return (
    <nav css={breadcrumbsCSS} className={className} aria-label="Breadcrumb">
      <ol>
        {childrenArray.map((child, index) => {
          const isLast = index === childrenArray.length - 1;
          
          return (
            <li key={index}>
              {isLast ? (
                <span className="breadcrumb-current" aria-current="page">
                  {React.isValidElement(child) ? child.props.children : child}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAction?.(index)}
                  aria-label={`Go to ${React.isValidElement(child) ? child.props.children : child}`}
                >
                  {React.isValidElement(child) ? child.props.children : child}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
} 