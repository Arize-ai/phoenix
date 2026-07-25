import { css } from "@emotion/react";
import {
  SelectionIndicator as AriaSelectionIndicator,
  ToggleButton as AriaToggleButton,
} from "react-aria-components";

import { Text } from "@phoenix/components/core/content";
import { classNames } from "@phoenix/utils/classNames";

import {
  segmentedControlItemContentCSS,
  segmentedControlItemCSS,
  segmentedControlThumbCSS,
} from "./styles";
import type { SegmentedControlItemProps } from "./types";

/**
 * A SegmentedControlItem represents an option within a SegmentedControl.
 */
export function SegmentedControlItem({
  children,
  className,
  css: cssProp,
  ...props
}: SegmentedControlItemProps) {
  return (
    <AriaToggleButton
      {...props}
      className={classNames("segmented-control__item", className)}
      css={css(segmentedControlItemCSS, cssProp)}
    >
      <div
        className="segmented-control__item-content"
        css={segmentedControlItemContentCSS}
      >
        {typeof children === "string" ? <Text>{children}</Text> : children}
      </div>
      <AriaSelectionIndicator
        className="segmented-control__thumb"
        css={segmentedControlThumbCSS}
      />
    </AriaToggleButton>
  );
}
