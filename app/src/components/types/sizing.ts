export type Size = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export type ComponentSize = Omit<Size, "XS" | "XL" | "XXL">;

export type TextSize = Size;

export type SizingProps = {
  /**
   * The size of the component
   * @default 'M'
   */
  size?: ComponentSize;
};
