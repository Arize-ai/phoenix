import { forwardRef, Ref } from "react";
import {
  Breadcrumb as AriaBreadcrumb,
  BreadcrumbProps as AriaBreadcrumbProps,
} from "react-aria-components";
import { css } from "@emotion/react";
import { Icon, Icons } from "../icon";

interface BreadcrumbProps extends AriaBreadcrumbProps {}

const breadcrumbCSS = css`
  display: flex;
  align-items: center;
  /* 
  &:not(:last-child)::after {
    content: "›";
    margin-left: var(--ac-global-dimension-size-75);
    margin-right: var(--ac-global-dimension-size-25);
    color: var(--ac-global-text-color-700);
    font-weight: normal;
    font-size: 1.2em;
  } */

  a {
    color: var(--ac-global-text-color-700);
    text-decoration: none;
    outline: none;
    border-radius: var(--ac-global-rounding-small);
    padding: var(--ac-global-dimension-size-25)
      var(--ac-global-dimension-size-50);
    margin: calc(-1 * var(--ac-global-dimension-size-25))
      calc(-1 * var(--ac-global-dimension-size-50));
  }

  &[data-current] {
    color: var(--ac-global-text-color-900);
    font-weight: 600;
    cursor: default;
  }
`;

function Breadcrumb(props: BreadcrumbProps, ref: Ref<HTMLDivElement>) {
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
