import React, { createContext, forwardRef, ReactNode, useContext } from "react";
import { useBreadcrumbItem, useBreadcrumbs } from "react-aria";

// Context to share breadcrumb state
interface BreadcrumbsContextValue {
  onAction?: (index: string | number) => void;
}

const BreadcrumbsContext = createContext<BreadcrumbsContextValue>({});

export interface BreadcrumbsProps {
  children: ReactNode;
  onAction?: (index: string | number) => void;
}

export interface BreadcrumbProps {
  children: ReactNode;
  href?: string;
  onPress?: () => void;
  isDisabled?: boolean;
  isCurrent?: boolean;
}

export const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(
  function Breadcrumbs({ children, onAction, ...props }, ref) {
    const { navProps } = useBreadcrumbs(props);

    return (
      <BreadcrumbsContext.Provider value={{ onAction }}>
        <nav {...navProps} ref={ref}>
          <ol>{children}</ol>
        </nav>
      </BreadcrumbsContext.Provider>
    );
  }
);

export const Breadcrumb = forwardRef<HTMLLIElement, BreadcrumbProps>(
  function Breadcrumb(
    { children, href, onPress, isDisabled, isCurrent, ...props },
    ref
  ) {
    const { onAction } = useContext(BreadcrumbsContext);
    const { itemProps } = useBreadcrumbItem(
      {
        children,
        onPress: onPress || (() => href && onAction?.(href)),
        isDisabled,
        isCurrent,
        ...props,
      },
      ref as React.RefObject<HTMLElement>
    );

    return (
      <li ref={ref}>
        {href && !isCurrent ? (
          <a href={href} {...itemProps}>
            {children}
          </a>
        ) : (
          <span {...itemProps}>{children}</span>
        )}
      </li>
    );
  }
);
