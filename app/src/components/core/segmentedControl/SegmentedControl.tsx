import { css } from "@emotion/react";
import { useObjectRef } from "@react-aria/utils";
import type { ReactNode } from "react";
import { Children, Fragment, isValidElement, useRef, useState } from "react";
import type { Key } from "react-aria-components";
import { ToggleButtonGroup as AriaToggleButtonGroup } from "react-aria-components";

import { classNames } from "@phoenix/utils/classNames";

import type { SegmentedControlScrollAnchor } from "./scrollAnchor";
import {
  captureSegmentedControlScrollAnchor,
  restoreSegmentedControlScrollAnchor,
} from "./scrollAnchor";
import type { SegmentedControlSelectionRegistry } from "./SegmentedControlContext";
import { SegmentedControlSelectionContext } from "./SegmentedControlContext";
import { useSegmentedControlThumb } from "./SegmentedControlThumb";
import { segmentedControlCSS } from "./styles";
import type { SegmentedControlItemProps, SegmentedControlProps } from "./types";

/** The first item the user could land on, used when the caller names no default. */
function getFirstEnabledItemId(children: ReactNode): Key | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<Partial<SegmentedControlItemProps>>(child)) {
      continue;
    }
    // Children.toArray flattens arrays but not fragments.
    if (child.type === Fragment) {
      const nestedId = getFirstEnabledItemId(
        (child.props as { children?: ReactNode }).children
      );
      if (nestedId != null) {
        return nestedId;
      }
      continue;
    }
    const { id, isDisabled } = child.props;
    if (id != null && !isDisabled) {
      return id;
    }
  }
  return undefined;
}

/**
 * A SegmentedControl is a mutually exclusive group of buttons used for view
 * switching. Unlike a `ToggleButtonGroup`, one segment is always selected — it
 * shows the current view rather than toggling options on and off.
 */
export function SegmentedControl({
  children,
  size = "M",
  isJustified = false,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  className,
  css: cssProp,
  ref,
  ...props
}: SegmentedControlProps) {
  const groupRef = useObjectRef(ref);
  // A segmented control always reflects a current view, so fall back to the
  // first segment. Held in state because react-aria only reads the default at
  // mount, so re-walking the children on later renders is wasted work.
  const [resolvedDefaultSelectedKey] = useState(
    () => defaultSelectedKey ?? getFirstEnabledItemId(children)
  );
  const { thumb, registry } = useSegmentedControlThumb();

  // Captured when the user changes the selection, consumed on the commit that
  // applies it — however the consumer schedules that commit (synchronous
  // state, context, or a transition). The item registration below is that
  // commit's signal, so no assumption about the consumer's timing is needed.
  const scrollAnchorRef = useRef<SegmentedControlScrollAnchor | null>(null);
  const hasRegisteredItemRef = useRef(false);
  const [selectionRegistry] = useState<SegmentedControlSelectionRegistry>(
    () => ({
      registerSelectedItem: (item) => {
        // Restore only when selection moves between items: a mount-time
        // registration discards any anchor rather than replaying a stale one.
        const isReplacingSelection = hasRegisteredItemRef.current;
        hasRegisteredItemRef.current = true;
        const unregister = registry.registerSelectedItem(item);
        const anchor = scrollAnchorRef.current;
        scrollAnchorRef.current = null;
        if (anchor && isReplacingSelection) {
          restoreSegmentedControlScrollAnchor(anchor);
        }
        return unregister;
      },
    })
  );

  return (
    <SegmentedControlSelectionContext.Provider value={selectionRegistry}>
      <AriaToggleButtonGroup
        {...props}
        ref={groupRef}
        selectionMode="single"
        disallowEmptySelection
        orientation="horizontal"
        selectedKeys={selectedKey !== undefined ? [selectedKey] : undefined}
        defaultSelectedKeys={
          resolvedDefaultSelectedKey != null
            ? [resolvedDefaultSelectedKey]
            : undefined
        }
        onSelectionChange={(keys) => {
          const [firstKey] = keys;
          if (firstKey != null) {
            // The selection swap may reflow every linked card in the stack;
            // remember where this control sits so it stays under the pointer.
            scrollAnchorRef.current = captureSegmentedControlScrollAnchor(
              groupRef.current
            );
            onSelectionChange?.(firstKey);
          }
        }}
        data-size={size}
        data-justified={isJustified}
        className={classNames("segmented-control", className)}
        css={css(segmentedControlCSS, cssProp)}
      >
        {thumb}
        {children}
      </AriaToggleButtonGroup>
    </SegmentedControlSelectionContext.Provider>
  );
}
