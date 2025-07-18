import React from "react";
import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
  Link,
} from "react-aria-components";

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

export const Breadcrumbs = ({ children, ...props }: BreadcrumbsProps) => {
  return <AriaBreadcrumbs {...props}>{children}</AriaBreadcrumbs>;
};

export const Breadcrumb = ({
  children,
  href,
  isDisabled,
  isCurrent,
  ...props
}: BreadcrumbProps) => {
  return (
    <AriaBreadcrumb {...props}>
      {href && !isCurrent ? (
        <Link href={href} isDisabled={isDisabled}>
          {children}
        </Link>
      ) : (
        <span>{children}</span>
      )}
    </AriaBreadcrumb>
  );
};
