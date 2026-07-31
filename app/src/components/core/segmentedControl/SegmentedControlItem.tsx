import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useContext, useLayoutEffect, useRef } from "react";
import { ToggleButton as AriaToggleButton } from "react-aria-components";

import { Text } from "@phoenix/components/core/content";
import { classNames } from "@phoenix/utils/classNames";

import { SegmentedControlSelectionContext } from "./SegmentedControlContext";
import {
  segmentedControlItemContentCSS,
  segmentedControlItemCSS,
} from "./styles";
import type { SegmentedControlItemProps } from "./types";

/**
 * The item's label box. While selected, it hands the item element (its parent
 * — read here because the item's own ref is not yet attached when a child's
 * mount effect runs) to the track, which owns the thumb and positions it in
 * its own coordinate space (see SegmentedControlThumb.tsx).
 */
function SegmentedControlItemContent({
  isSelected,
  children,
}: {
  isSelected: boolean;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const registry = useContext(SegmentedControlSelectionContext);
  useLayoutEffect(() => {
    const item = contentRef.current?.parentElement;
    if (!isSelected || !item || !registry) {
      return undefined;
    }
    return registry.registerSelectedItem(item);
  }, [isSelected, registry]);
  return (
    <div
      ref={contentRef}
      className="segmented-control__item-content"
      css={segmentedControlItemContentCSS}
    >
      {typeof children === "string" ? <Text>{children}</Text> : children}
    </div>
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
        <SegmentedControlItemContent isSelected={isSelected}>
          {children}
        </SegmentedControlItemContent>
      )}
    </AriaToggleButton>
  );
}
