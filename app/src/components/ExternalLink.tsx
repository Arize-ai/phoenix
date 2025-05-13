import { ReactNode } from "react";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";

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
        position: relative;
        &:hover {
          text-decoration: underline;
        }
        .ac-icon-wrap {
          display: inline-block;
          margin-left: 0.1em;
          vertical-align: middle;
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
