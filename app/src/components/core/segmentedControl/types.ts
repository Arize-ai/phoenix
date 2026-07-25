import type { ReactNode, Ref } from "react";
import type {
  Key,
  ToggleButtonGroupProps as AriaToggleButtonGroupProps,
  ToggleButtonProps as AriaToggleButtonProps,
} from "react-aria-components";

import type {
  SizingProps,
  StylableProps,
} from "@phoenix/components/core/types";

/**
 * The segmented control owns selection, orientation, and layout, so the
 * underlying multi-select toggle group API is not passed through.
 */
type InheritedGroupProps = Omit<
  AriaToggleButtonGroupProps,
  | "children"
  | "className"
  | "defaultSelectedKeys"
  | "disallowEmptySelection"
  | "onSelectionChange"
  | "orientation"
  | "selectedKeys"
  | "selectionMode"
>;

export interface SegmentedControlProps
  extends InheritedGroupProps, SizingProps, StylableProps {
  /**
   * The content to display in the segmented control. Expects `SegmentedControlItem` children.
   */
  children: ReactNode;
  /**
   * Whether the items should divide the container width equally.
   * @default false
   */
  isJustified?: boolean;
  /** The id of the currently selected item (controlled). */
  selectedKey?: Key;
  /** The id of the initial selected item (uncontrolled). */
  defaultSelectedKey?: Key;
  /** Handler that is called when the selection changes. */
  onSelectionChange?: (id: Key) => void;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Selection lives on the group, so the standalone toggle props are not
 * passed through to the item.
 */
type InheritedItemProps = Omit<
  AriaToggleButtonProps,
  "children" | "className" | "defaultSelected" | "isSelected" | "onChange"
>;

export interface SegmentedControlItemProps
  extends InheritedItemProps, StylableProps {
  /**
   * The content to display in the segmented control item. A string is wrapped
   * in a `Text` for you; otherwise compose an `Icon`, a `Text`, or both.
   */
  children: ReactNode;
  /** The id of the item, matching the value used in SegmentedControl's `selectedKey` prop. */
  id: Key;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}
