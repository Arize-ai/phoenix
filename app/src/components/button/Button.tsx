import { forwardRef, ReactNode, Ref, useCallback } from "react";
import { Button as AriaButton, ButtonRenderProps } from "react-aria-components";
import { css } from "@emotion/react";

import { useSize } from "@phoenix/contexts";

import { buttonCSS } from "./styles";
import { ButtonProps } from "./types";

function Button(props: ButtonProps, ref: Ref<HTMLButtonElement>) {
  const {
    size: propSize,
    variant = "default",
    leadingVisual,
    trailingVisual,
    children,
    css: propCSS,
    ...otherProps
  } = props;
  // If the toggle button is nested under a button group, use the size of the button group
  const contextSize = useSize();
  const size = propSize || contextSize || "M";

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

const _Button = forwardRef(Button);
export { _Button as Button };
