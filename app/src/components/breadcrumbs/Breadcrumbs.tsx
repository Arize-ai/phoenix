import { css } from "@emotion/react";
import type { Ref } from "react";
import { forwardRef } from "react";
import type { BreadcrumbsProps as AriaBreadcrumbsProps } from "react-aria-components";
import { Breadcrumbs as AriaBreadcrumbs } from "react-aria-components";

import type { ComponentSize } from "@phoenix/components/types";

export interface BreadcrumbProps<T> extends AriaBreadcrumbsProps<T> {
  size?: ComponentSize;
}

const breadcrumbsCSS = css`
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
  color: var(--global-text-color-900);
  --breadcrumb-separator-icon-padding: var(--global-dimension-size-50);

  &[data-size="S"] {
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    --breadcrumb-separator-icon-padding: var(--global-dimension-size-25);
  }

  &[data-size="M"] {
    font-size: var(--global-font-size-m);
    line-height: var(--global-line-height-m);
    --breadcrumb-separator-icon-padding: var(--global-dimension-size-50);
  }

  &[data-size="L"] {
    font-size: var(--global-font-size-l);
    line-height: var(--global-line-height-l);
    --breadcrumb-separator-icon-padding: var(--global-dimension-size-75);
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
