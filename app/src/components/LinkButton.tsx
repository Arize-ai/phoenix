import React, { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";

const linkButtonCSS = css`
  display: inline-flex;
  align-items: center;
  background: none;
  color: var(--ac-global-color-primary);
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  outline: inherit;
  &:hover {
    text-decoration: underline;
  }
`;
export function LinkButton(props: PropsWithChildren<{ onClick: () => void }>) {
  const { children, onClick } = props;
  return (
    <button css={linkButtonCSS} onClick={onClick}>
      {children} <Icon svg={<Icons.ArrowIosForwardOutline />} />
    </button>
  );
}
