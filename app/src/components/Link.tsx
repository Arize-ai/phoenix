import { css } from "@emotion/react";
import React from "react";
import { LinkProps, Link as RouterLink } from "react-router-dom";
export function Link(props: LinkProps) {
  return (
    <RouterLink
      css={(theme) => css`
        color: ${theme.colors.arizeLightBlue};
        &:not(:hover) {
          text-decoration: none;
        }
      `}
      {...props}
    />
  );
}
