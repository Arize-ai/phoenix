import { forwardRef, Ref } from "react";
import {
  Breadcrumbs as AriaBreadcrumbs,
  BreadcrumbsProps as AriaBreadcrumbsProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { ComponentSize } from "@phoenix/components/types";

export interface BreadcrumbProps<T> extends AriaBreadcrumbsProps<T> {
  size?: ComponentSize;
}

const breadcrumbsCSS = css`
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
  color: var(--ac-global-text-color-900);
  --breadcrumb-separator-icon-padding: var(--ac-global-dimension-size-50);

  &[data-size="S"] {
    font-size: var(--ac-global-font-size-s);
    line-height: var(--ac-global-line-height-s);
    --breadcrumb-separator-icon-padding: var(--ac-global-dimension-size-25);
  }

  &[data-size="M"] {
    font-size: var(--ac-global-font-size-m);
    line-height: var(--ac-global-line-height-m);
    --breadcrumb-separator-icon-padding: var(--ac-global-dimension-size-50);
  }

  &[data-size="L"] {
    font-size: var(--ac-global-font-size-l);
    line-height: var(--ac-global-line-height-l);
    --breadcrumb-separator-icon-padding: var(--ac-global-dimension-size-75);
  }

  .ac-icon-wrap {
    padding: 0 var(--breadcrumb-separator-icon-padding);
  }
`;

function Breadcrumbs<T extends object>(
  props: BreadcrumbProps<T>,
  ref: Ref<HTMLOListElement>
) {
  const { size = "M", ...rest } = props;
  return (
    <AriaBreadcrumbs<T>
      css={breadcrumbsCSS}
      {...rest}
      ref={ref}
      data-size={size}
    />
  );
}

const _Breadcrumbs = forwardRef(Breadcrumbs);
export { _Breadcrumbs as Breadcrumbs };
