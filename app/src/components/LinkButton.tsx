import React, { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { ArrowIosForwardOutline, Icon } from "@arizeai/components";

const linkButtonCSS = css`
  display: inline-flex;
  align-items: center;
  background: none;
  color: var(--ac-global-color-primary);

  background: none;
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
      {children} <Icon svg={<ArrowIosForwardOutline />} />
    </button>
  );
}
