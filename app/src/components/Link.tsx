import { Link as RouterLink, LinkProps } from "react-router";
import { css } from "@emotion/react";
export function Link(props: LinkProps) {
  return (
    // Stop propagation to prevent the click from being handled by the parent
    <div
      className="link-container"
      onClick={(e) => e.stopPropagation()}
      css={css`
        display: inline-block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      `}
    >
      <RouterLink
        css={css`
          color: var(--global-link-color);
          &:not(:hover) {
            text-decoration: none;
          }
        `}
        {...props}
      />
    </div>
  );
}
