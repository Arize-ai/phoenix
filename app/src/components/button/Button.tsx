import React, { ReactNode, Ref } from "react";
import {
  Button as AriaButton,
  ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import {
  SizingProps,
  StylableProps,
  VarianceProps,
} from "@phoenix/components/types";

import { buttonCSS } from "./styles";

interface ButtonProps
  extends AriaButtonProps,
    SizingProps,
    VarianceProps,
    StylableProps {
  /**
   * An optional prefixed icon for the button
   */
  icon?: ReactNode;
}

function Button(props: ButtonProps, ref: Ref<HTMLButtonElement>) {
  const {
    size = "M",
    variant = "default",
    icon,
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
      {icon}
      <>{children}</>
    </AriaButton>
  );
}

const _Button = React.forwardRef(Button);
export { _Button as Button, ButtonProps };
