export type Size = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export type ComponentSize = Exclude<Size, "XS" | "XL" | "XXL">;

export type BorderRadiusSize = Exclude<Size, "XL" | "XXL">;

export type BorderRadiusToken = BorderRadiusSize | "none" | "circle";

export type TextSize = Size;

export type SizingProps = {
  /**
   * The size of the component
   * @default 'M'
   */
  size?: ComponentSize;
};
