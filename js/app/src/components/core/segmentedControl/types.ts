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

/** Selection, orientation, and layout are the control's, not the caller's. */
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
  /** Expects `SegmentedControlItem` children. */
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

/** Selection lives on the group, so the standalone toggle props are dropped. */
type InheritedItemProps = Omit<
  AriaToggleButtonProps,
  "children" | "className" | "defaultSelected" | "isSelected" | "onChange"
>;

export interface SegmentedControlItemProps
  extends InheritedItemProps, StylableProps {
  /** A string is wrapped in a `Text`; otherwise compose an `Icon`, a `Text`, or both. */
  children: ReactNode;
  /** Matches the value used in SegmentedControl's `selectedKey`. */
  id: Key;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}
