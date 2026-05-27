import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import { useCallback } from "react";
import type { ButtonRenderProps } from "react-aria-components";
import { Button as AriaButton } from "react-aria-components";

import { useSize } from "@phoenix/components/core/contexts/SizeContext";
import { classNames } from "@phoenix/utils/classNames";

import { buttonCSS } from "./styles";
import { Tooltip, TooltipArrow, TooltipTrigger } from "../tooltip";
import type { ButtonProps } from "./types";

function Button({
  ref,
  ...props
}: ButtonProps & { ref?: Ref<HTMLButtonElement> }) {
  const {
    size: propSize,
    variant = "default",
    leadingVisual,
    trailingVisual,
    children,
    css: propCSS,
    className,
    disabledReason,
    disabledReasonPlacement = "top",
    disabledReasonOffset = 8,
    isDisabled,
    onPress,
    onPressStart,
    onPressEnd,
    onPressChange,
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
  const shouldShowDisabledReason = Boolean(isDisabled && disabledReason);

  const button = (
    <AriaButton
      {...otherProps}
      ref={ref}
      isDisabled={shouldShowDisabledReason ? false : isDisabled}
      aria-disabled={shouldShowDisabledReason ? true : undefined}
      onPress={shouldShowDisabledReason ? undefined : onPress}
      onPressStart={shouldShowDisabledReason ? undefined : onPressStart}
      onPressEnd={shouldShowDisabledReason ? undefined : onPressEnd}
      onPressChange={shouldShowDisabledReason ? undefined : onPressChange}
      data-size={size}
      data-variant={variant}
      data-childless={!children}
      css={css(buttonCSS, propCSS)}
      className={classNames("react-aria-Button", className)}
    >
      {renderContent}
    </AriaButton>
  );

  if (!shouldShowDisabledReason) {
    return button;
  }

  return (
    <TooltipTrigger delay={700} closeDelay={0}>
      {button}
      <Tooltip placement={disabledReasonPlacement} offset={disabledReasonOffset}>
        <TooltipArrow />
        {disabledReason}
      </Tooltip>
    </TooltipTrigger>
  );
}

export { Button };
