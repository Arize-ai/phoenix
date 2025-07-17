import { forwardRef, Ref } from "react";
import { Link, LinkProps } from "react-router";
import { css } from "@emotion/react";

import { buttonCSS } from "./styles";
import { ButtonProps } from "./types";

interface LinkButtonProps
  extends Pick<LinkProps, "to" | "children">,
    Pick<
      ButtonProps,
      | "size"
      | "variant"
      | "leadingVisual"
      | "trailingVisual"
      | "css"
      | "isDisabled"
    > {}

const linkButtonCSS = css`
  text-decoration: none;
  user-select: none;
  &[data-disabled="true"] {
    pointer-events: none;
    cursor: default;
    opacity: var(--ac-opacity-disabled);
  }
`;
/**
 * A link that is rendered as a button
 * This is useful when you want the link to be styled as a button but you want the semantic meaning of a link
 */
function LinkButton(props: LinkButtonProps, ref: Ref<HTMLAnchorElement>) {
  const {
    size = "M",
    variant = "default",
    leadingVisual,
    trailingVisual,
    children,
    css: propCSS,
    isDisabled,
    to,
  } = props;
  return (
    <Link
      ref={ref}
      data-size={size}
      data-variant={variant}
      data-childless={!children}
      data-disabled={isDisabled}
      css={css(buttonCSS, linkButtonCSS, propCSS)}
      to={to}
    >
      {leadingVisual}
      {children}
      {trailingVisual}
    </Link>
  );
}

const _LinkButton = forwardRef(LinkButton);
export { _LinkButton as LinkButton, LinkButtonProps };
