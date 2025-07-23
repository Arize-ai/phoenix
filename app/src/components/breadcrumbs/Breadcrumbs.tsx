import React, { forwardRef, Ref } from "react";
import { Breadcrumbs as AriaBreadcrumbs } from "react-aria-components";
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
  margin: 0;
  padding: 0;
  font-size: var(--ac-global-dimension-font-size-100);
  color: var(--ac-global-text-color-900);
`;

function Breadcrumbs(props: BreadcrumbsProps, ref: Ref<HTMLOListElement>) {
  return <AriaBreadcrumbs css={breadcrumbsCSS} {...props} ref={ref} />;
}

const _Breadcrumbs = forwardRef(Breadcrumbs);
export { _Breadcrumbs as Breadcrumbs };
