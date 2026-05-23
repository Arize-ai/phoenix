/** A 2D point in pixel coordinates. */
export type Point = {
  x: number;
  y: number;
};

/** A 2D dimension (no origin) in pixels. */
export type Size = {
  width: number;
  height: number;
};

/** An axis-aligned rectangle in pixel coordinates. */
export type Bounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Per-axis margin in pixels (matches CSS `inline` / `block` semantics). */
export type Inset = {
  horizontal: number;
  vertical: number;
};
