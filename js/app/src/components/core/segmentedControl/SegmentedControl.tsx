import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Children, Fragment, isValidElement, useState } from "react";
import type { Key } from "react-aria-components";
import { ToggleButtonGroup as AriaToggleButtonGroup } from "react-aria-components";

import { classNames } from "@phoenix/utils/classNames";

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
  ...props
}: SegmentedControlProps) {
  // A segmented control always reflects a current view, so fall back to the
  // first segment. Held in state because react-aria only reads the default at
  // mount, so re-walking the children on later renders is wasted work.
  const [resolvedDefaultSelectedKey] = useState(
    () => defaultSelectedKey ?? getFirstEnabledItemId(children)
  );

  return (
    <AriaToggleButtonGroup
      {...props}
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
          onSelectionChange?.(firstKey);
        }
      }}
      data-size={size}
      data-justified={isJustified}
      className={classNames("segmented-control", className)}
      css={css(segmentedControlCSS, cssProp)}
    >
      {children}
    </AriaToggleButtonGroup>
  );
}
