import React, { Ref } from "react";
import { css } from "@emotion/react";

import { buttonCSS } from "./styles";
import { ButtonProps } from "./types";

// Custom props for the button styling and visuals
interface ExternalLinkButtonCustomProps
  extends Pick<
    ButtonProps,
    | "size"
    | "variant"
    | "leadingVisual"
    | "trailingVisual"
    | "css"
    | "isDisabled"
  > {}

// Main props type: all anchor props + custom button props
export type ExternalLinkButtonProps =
  React.AnchorHTMLAttributes<HTMLAnchorElement> & ExternalLinkButtonCustomProps;

const externalLinkButtonCSS = css`
  text-decoration: none;
  user-select: none;
  &[data-disabled="true"] {
    pointer-events: none;
    cursor: default;
    opacity: var(--ac-global-opacity-disabled);
  }
`;

/**
 * A button-styled external link that opens in a new tab
 */
function ExternalLinkButton(
  props: ExternalLinkButtonProps,
  ref: Ref<HTMLAnchorElement>
) {
  const {
    size = "M",
    variant = "default",
    leadingVisual,
    trailingVisual,
    children,
    css: propCSS,
    isDisabled,
    target = "_blank",
    ...rest
  } = props;

  return (
    <a
      ref={ref}
      target={target}
      rel="noopener noreferrer"
      data-size={size}
      data-variant={variant}
      data-childless={!children}
      data-disabled={isDisabled}
      css={css(buttonCSS, externalLinkButtonCSS, propCSS)}
      tabIndex={isDisabled ? -1 : undefined}
      aria-disabled={isDisabled}
      {...rest}
    >
      {leadingVisual}
      {children}
      {trailingVisual}
    </a>
  );
}

const _ExternalLinkButton = React.forwardRef(ExternalLinkButton);
export { _ExternalLinkButton as ExternalLinkButton };
