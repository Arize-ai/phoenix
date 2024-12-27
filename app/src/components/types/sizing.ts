export type Size = "XS" | "S" | "M" | "L" | "XL";

export type ComponentSize = Omit<Size, "XS" | "XL">;

export type TextSize = Size;

export type SizingProps = {
  /**
   * The size of the component
   * @default 'M'
   */
  size?: ComponentSize;
};
