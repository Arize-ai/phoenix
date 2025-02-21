import React, { Ref } from "react";
import { Button as AriaButton } from "react-aria-components";
import { css } from "@emotion/react";

import { buttonCSS } from "./styles";
import { ButtonProps } from "./types";

function Button(props: ButtonProps, ref: Ref<HTMLButtonElement>) {
  const {
    size = "M",
    variant = "default",
    leadingVisual,
    trailingVisual,
    children,
    css: propCSS,
    ...otherProps
  } = props;

  return (
    <AriaButton
      {...otherProps}
      ref={ref}
      data-size={size}
      data-variant={variant}
      data-childless={!children}
      css={css(buttonCSS, propCSS)}
    >
      {leadingVisual}
      <>{children}</>
      {trailingVisual}
    </AriaButton>
  );
}

const _Button = React.forwardRef(Button);
export { _Button as Button };
