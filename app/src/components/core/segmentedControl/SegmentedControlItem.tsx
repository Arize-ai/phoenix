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
 * react-aria slides the thumb by seeding an inline `translate` with the viewport
 * delta between the outgoing and incoming segment, measured on both axes. Drop
 * the vertical one, or page reflow flings the thumb off its track. Takes
 * `isSelected` as a prop so a selection change re-renders it, running this
 * layout effect after the indicator child has seeded the value.
 */
function SegmentedControlThumb({ isSelected }: { isSelected: boolean }) {
  const thumbRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
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
