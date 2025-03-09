import React, { ReactNode, Ref, useCallback } from "react";
import { Button as AriaButton, ButtonRenderProps } from "react-aria-components";
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

  const renderContent = useCallback(
    (props: ButtonRenderProps & { defaultChildren: ReactNode }) => {
      return (
        <>
          {leadingVisual}
          {typeof children === "function" ? children(props) : children}
          {trailingVisual}
        </>
      );
    },
    [leadingVisual, trailingVisual, children]
  );
  return (
    <AriaButton
      {...otherProps}
      ref={ref}
      data-size={size}
      data-variant={variant}
      data-childless={!children}
      css={css(buttonCSS, propCSS)}
    >
      {renderContent}
    </AriaButton>
  );
}

const _Button = React.forwardRef(Button);
export { _Button as Button };
