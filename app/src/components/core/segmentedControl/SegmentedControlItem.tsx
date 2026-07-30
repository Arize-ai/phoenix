import { css } from "@emotion/react";
import { useContext, useLayoutEffect, useRef } from "react";
import {
  SelectionIndicator as AriaSelectionIndicator,
  ToggleButton as AriaToggleButton,
} from "react-aria-components";

import { Text } from "@phoenix/components/core/content";
import { classNames } from "@phoenix/utils/classNames";

import { SegmentedControlItemOffsetContext } from "./SegmentedControlContext";
import {
  segmentedControlItemContentCSS,
  segmentedControlItemCSS,
  segmentedControlThumbCSS,
} from "./styles";
import type { SegmentedControlItemProps } from "./types";

/**
 * React Aria seeds the thumb's transition from viewport rectangles. Replace
 * that delta with the distance between the items inside this track, so page or
 * toolbar reflow cannot move the thumb outside the control.
 */
function SegmentedControlThumb({ isSelected }: { isSelected: boolean }) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const selectedItemOffsetRef = useContext(SegmentedControlItemOffsetContext);

  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    const item = thumb?.parentElement;
    if (!thumb || !item || !isSelected) {
      return undefined;
    }

    const previousItemOffset = selectedItemOffsetRef?.current;
    const translate = thumb.style.translate.trim();
    if (translate) {
      const fallbackTranslateX = translate.split(/\s+/)[0];
      const translateX =
        previousItemOffset == null
          ? fallbackTranslateX
          : `${previousItemOffset - item.offsetLeft}px`;
      thumb.style.translate = `${translateX} 0px`;
    }

    return () => {
      if (selectedItemOffsetRef) {
        selectedItemOffsetRef.current = item.offsetLeft;
      }
    };
  }, [isSelected, selectedItemOffsetRef]);

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
