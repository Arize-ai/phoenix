import { forwardRef, Ref } from "react";
import {
  Breadcrumb as AriaBreadcrumb,
  BreadcrumbProps as AriaBreadcrumbProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";

type BreadcrumbProps = AriaBreadcrumbProps;

const breadcrumbCSS = css`
  display: flex;
  align-items: center;

  a {
    color: var(--ac-global-text-color-700);
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }

  &[data-current],
  &[data-current] a {
    color: var(--ac-global-text-color-900);
    font-weight: 600;
    cursor: default;
    &:hover {
      text-decoration: none;
    }
  }
`;

function Breadcrumb(props: BreadcrumbProps, ref: Ref<HTMLLIElement>) {
  const { children, ...rest } = props;
  return (
    <AriaBreadcrumb css={breadcrumbCSS} {...rest} ref={ref}>
      {({ isCurrent }) => (
        <>
          {children}
          {!isCurrent && <Icon svg={<Icons.ChevronRight />} />}
        </>
      )}
    </AriaBreadcrumb>
  );
}

const _Breadcrumb = forwardRef(Breadcrumb);
export { _Breadcrumb as Breadcrumb };
