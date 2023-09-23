import React from "react";
import { Link as RouterLink, LinkProps } from "react-router-dom";
import { css } from "@emotion/react";
export function Link(props: LinkProps) {
  return (
    // Stop propagation to prevent the click from being handled by the parent
    <div onClick={(e) => e.stopPropagation()}>
      <RouterLink
        css={(theme) => css`
          color: ${theme.colors.arizeLightBlue};
          &:not(:hover) {
            text-decoration: none;
          }
        `}
        {...props}
      />
    </div>
  );
}
