import { css } from "@emotion/react";
import { useContext, useLayoutEffect, useRef } from "react";
import {
  SelectionIndicator as AriaSelectionIndicator,
  SelectionIndicatorContext as AriaSelectionIndicatorContext,
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
 * Keeps react-aria's shared selection indicator on the control's horizontal
 * axis. Its general-purpose FLIP measurement includes viewport movement in
 * both axes, but vertical page reflow must not move a horizontal control's
 * thumb outside its track.
 */
function SegmentedControlThumb() {
  const thumbRef = useRef<HTMLDivElement>(null);
  const selectionIndicatorContext = useContext(AriaSelectionIndicatorContext);
  const isSelected =
    selectionIndicatorContext != null &&
    "isSelected" in selectionIndicatorContext &&
    selectionIndicatorContext.isSelected;

  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    const inlineTranslate = thumb?.style.translate.trim();
    if (!thumb || !isSelected || !inlineTranslate) {
      return;
    }

    // The child indicator measures first. Preserve its horizontal FLIP delta,
    // then discard any viewport-derived vertical delta before paint.
    const [translateX] = inlineTranslate.split(/\s+/);
    thumb.style.translate = `${translateX} 0px`;
  });

  return (
    <AriaSelectionIndicator
      ref={thumbRef}
      className="segmented-control__thumb"
      css={segmentedControlThumbCSS}
    />
  );
}

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
      <SegmentedControlThumb />
    </AriaToggleButton>
  );
}
