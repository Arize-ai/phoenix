import React, { ReactNode } from "react";
import { css } from "@emotion/react";

import { Icon, Icons } from "@arizeai/components";

export type ExternalLinkProps = {
  href: string;
  children: ReactNode;
};

export function ExternalLink({ href, children }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      css={css`
        color: var(--ac-global-color-primary);
        text-decoration: none;
        display: flex;
        flex-direction: row;
        align-items: end;
        gap: var(--px-spacing-sm);
        &:hover {
          text-decoration: underline;
        }
        .ac-icon-wrap {
          font-size: 1em;
        }
      `}
      rel="noreferrer"
    >
      {children}
      <Icon svg={<Icons.ExternalLinkOutline />} />
    </a>
  );
}
