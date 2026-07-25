import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Children, Fragment, isValidElement, useState } from "react";
import type { Key } from "react-aria-components";
import { ToggleButtonGroup as AriaToggleButtonGroup } from "react-aria-components";

import { classNames } from "@phoenix/utils/classNames";

import { segmentedControlCSS } from "./styles";
import type { SegmentedControlItemProps, SegmentedControlProps } from "./types";

/**
 * The id of the first item the user could actually land on, used to seed the
 * selection when the caller doesn't name one.
 */
function getFirstEnabledItemId(children: ReactNode): Key | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<Partial<SegmentedControlItemProps>>(child)) {
      continue;
    }
    // `Children.toArray` flattens arrays but not fragments, so recurse into
    // them — a caller who groups related segments in a fragment should still
    // land on the first segment rather than on no selection at all.
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
  // A segmented control always reflects a current view, so when the caller
  // doesn't name a default, start on the first segment. Computed lazily —
  // react-aria only reads the default at mount, and this avoids re-walking
  // the children on every render. Harmless when `selectedKey` is controlled,
  // since the default is ignored entirely in that case.
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
