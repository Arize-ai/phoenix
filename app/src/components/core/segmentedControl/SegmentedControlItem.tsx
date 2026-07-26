import { css } from "@emotion/react";
import { useLayoutEffect, useRef } from "react";
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
 * react-aria slides the shared thumb by seeding an inline `translate` with the
 * viewport delta between the outgoing and incoming segment. It measures both
 * axes, so vertical page movement between those two measurements would fling a
 * horizontal control's thumb off its track — keep the horizontal delta, drop
 * the vertical one. The indicator is a child, so its layout effect has already
 * seeded the value by the time this one runs.
 */
function SegmentedControlThumb({ isSelected }: { isSelected: boolean }) {
  const thumbRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Only the incoming thumb is seeded; every other render leaves it empty.
    const thumb = thumbRef.current;
    const translate = thumb?.style.translate;
    if (thumb && isSelected && translate) {
      thumb.style.translate = `${translate.split(" ")[0]} 0px`;
    }
  }, [isSelected]);

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
      {/* Render props, so the thumb re-renders when selection changes and its
          layout effect gets a chance to correct the seeded translate. */}
      {({ isSelected }) => (
        <>
          <div
            className="segmented-control__item-content"
            css={segmentedControlItemContentCSS}
          >
            {typeof children === "string" ? <Text>{children}</Text> : children}
          </div>
          <SegmentedControlThumb isSelected={isSelected} />
        </>
      )}
    </AriaToggleButton>
  );
}
