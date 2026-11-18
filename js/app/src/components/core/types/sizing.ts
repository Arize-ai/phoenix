export type Size = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export type ComponentSize = Exclude<Size, "XS" | "XL" | "XXL">;

export type TextSize = Size;

export type SizingProps = {
  /**
   * The size of the component
   * @default 'M'
   */
  size?: ComponentSize;
};

/**
 * The sizes of the badge family: `S` inside menu items and pickers, `M`
 * everywhere else.
 */
export type FamilySize = Exclude<ComponentSize, "L">;
