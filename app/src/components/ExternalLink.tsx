import { ReactNode } from "react";
import { css } from "@emotion/react";

import { Icon, Icons } from "./icon";

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
        color: var(--ac-global-link-color);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        &:hover {
          text-decoration: underline;
        }
        .ac-icon-wrap {
          display: inline-block;
          margin-left: 0.1em;
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
