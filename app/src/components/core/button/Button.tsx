import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import { forwardRef, useCallback } from "react";
import type { ButtonRenderProps } from "react-aria-components";
import { Button as AriaButton } from "react-aria-components";

import { useSize } from "@phoenix/contexts";
import { classNames } from "@phoenix/utils";

import { buttonCSS } from "./styles";
import type { ButtonProps } from "./types";

function Button(props: ButtonProps, ref: Ref<HTMLButtonElement>) {
  const {
    size: propSize,
    variant = "default",
    leadingVisual,
    trailingVisual,
    children,
    css: propCSS,
    className,
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
      className={classNames("react-aria-Button", className)}
    >
      {renderContent}
    </AriaButton>
  );
}

const _Button = forwardRef(Button);
export { _Button as Button };
