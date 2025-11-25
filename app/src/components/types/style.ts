import { SerializedStyles } from "@emotion/react";

export type ColorValue =
  | "grey-50"
  | "grey-75"
  | "grey-100"
  | "grey-200"
  | "grey-300"
  | "grey-400"
  | "grey-500"
  | "grey-600"
  | "grey-700"
  | "grey-800"
  | "grey-900"
  | "blue-100"
  | "blue-200"
  | "blue-300"
  | "blue-400"
  | "blue-500"
  | "blue-600"
  | "blue-700"
  | "blue-800"
  | "blue-900"
  | "blue-1000"
  | "blue-1100"
  | "blue-1200"
  | "blue-1300"
  | "blue-1400"
  | "red-100"
  | "red-200"
  | "red-300"
  | "red-400"
  | "red-500"
  | "red-600"
  | "red-700"
  | "red-800"
  | "red-900"
  | "red-1000"
  | "red-1100"
  | "red-1200"
  | "red-1300"
  | "red-1400"
  | "orange-100"
  | "orange-200"
  | "orange-300"
  | "orange-400"
  | "orange-500"
  | "orange-600"
  | "orange-700"
  | "orange-800"
  | "orange-900"
  | "yellow-100"
  | "yellow-200"
  | "yellow-300"
  | "yellow-400"
  | "yellow-500"
  | "yellow-600"
  | "yellow-700"
  | "yellow-800"
  | "yellow-900"
  | "yellow-1000"
  | "yellow-1100"
  | "yellow-1200"
  | "yellow-1300"
  | "yellow-1400"
  | "green-100"
  | "green-200"
  | "green-300"
  | "green-400"
  | "green-500"
  | "green-600"
  | "green-700"
  | "green-800"
  | "green-900"
  | "green-1000"
  | "green-1100"
  | "green-1200"
  | "green-1300"
  | "green-1400"
  | "celery-100"
  | "celery-200"
  | "celery-300"
  | "celery-400"
  | "celery-500"
  | "celery-600"
  | "celery-700"
  | "celery-800"
  | "celery-900"
  | "celery-1000"
  | "celery-1100"
  | "celery-1200"
  | "celery-1300"
  | "celery-1400"
  | "seafoam-100"
  | "seafoam-200"
  | "seafoam-300"
  | "seafoam-400"
  | "seafoam-500"
  | "seafoam-600"
  | "seafoam-700"
  | "seafoam-800"
  | "seafoam-900"
  | "seafoam-1000"
  | "seafoam-1100"
  | "seafoam-1200"
  | "seafoam-1300"
  | "seafoam-1400"
  | "cyan-100"
  | "cyan-200"
  | "cyan-300"
  | "cyan-400"
  | "cyan-500"
  | "cyan-600"
  | "cyan-700"
  | "cyan-800"
  | "cyan-900"
  | "cyan-1000"
  | "cyan-1100"
  | "cyan-1200"
  | "cyan-1300"
  | "cyan-1400"
  | "indigo-100"
  | "indigo-200"
  | "indigo-300"
  | "indigo-400"
  | "indigo-500"
  | "indigo-600"
  | "indigo-700"
  | "indigo-800"
  | "indigo-900"
  | "indigo-1000"
  | "indigo-1100"
  | "indigo-1200"
  | "indigo-1300"
  | "indigo-1400"
  | "purple-100"
  | "purple-200"
  | "purple-300"
  | "purple-400"
  | "purple-500"
  | "purple-600"
  | "purple-700"
  | "purple-800"
  | "purple-900"
  | "purple-1000"
  | "purple-1100"
  | "purple-1200"
  | "purple-1300"
  | "purple-1400"
  | "fuchsia-100"
  | "fuchsia-200"
  | "fuchsia-300"
  | "fuchsia-400"
  | "fuchsia-500"
  | "fuchsia-600"
  | "fuchsia-700"
  | "fuchsia-800"
  | "fuchsia-900"
  | "fuchsia-1000"
  | "fuchsia-1100"
  | "fuchsia-1200"
  | "fuchsia-1300"
  | "fuchsia-1400"
  | "magenta-100"
  | "magenta-200"
  | "magenta-300"
  | "magenta-400"
  | "magenta-500"
  | "magenta-600"
  | "magenta-700"
  | "magenta-800"
  | "magenta-900"
  | "magenta-1000"
  | "magenta-1100"
  | "magenta-1200"
  | "magenta-1300"
  | "magenta-1400"
  | "chartreuse-100"
  | "chartreuse-200"
  | "chartreuse-300"
  | "chartreuse-400"
  | "chartreuse-500"
  | "chartreuse-600"
  | "chartreuse-700"
  | "chartreuse-800"
  | "chartreuse-900"
  | "chartreuse-1000"
  | "chartreuse-1100"
  | "chartreuse-1200"
  | "chartreuse-1300"
  | "chartreuse-1400"
  | "orange-100"
  | "orange-200"
  | "orange-300"
  | "orange-400"
  | "orange-500"
  | "orange-600"
  | "orange-700"
  | "orange-800"
  | "orange-900"
  | "orange-1000"
  | "orange-1100"
  | "orange-1200"
  | "orange-1300"
  | "orange-1400"
  | "success"
  | "warning"
  | "danger"
  | "info";

/**
 * the visual dimension of a component. E.g. width, height, padding, margin, etc.
 * @see https://github.com/adobe/react-spectrum/blob/4a7576870d4dbe80cdbebba2043f593474ad6cb4/packages/%40react-types/shared/src/dna.d.ts#L16
 */
export type DimensionValue =
  | "size-0"
  | "size-10"
  | "size-25"
  | "size-40"
  | "size-50"
  | "size-65"
  | "size-75"
  | "size-85"
  | "size-100"
  | "size-115"
  | "size-125"
  | "size-130"
  | "size-150"
  | "size-160"
  | "size-175"
  | "size-200"
  | "size-225"
  | "size-250"
  | "size-275"
  | "size-300"
  | "size-325"
  | "size-350"
  | "size-400"
  | "size-450"
  | "size-500"
  | "size-550"
  | "size-600"
  | "size-675"
  | "size-700"
  | "size-800"
  | "size-900"
  | "size-1000"
  | "size-1200"
  | "size-1250"
  | "size-1600"
  | "size-1700"
  | "size-2000"
  | "size-2400"
  | "size-3000"
  | "size-3400"
  | "size-3600"
  | "size-4600"
  | "size-5000"
  | "size-6000"
  | "static-size-0"
  | "static-size-10"
  | "static-size-25"
  | "static-size-50"
  | "static-size-40"
  | "static-size-65"
  | "static-size-100"
  | "static-size-115"
  | "static-size-125"
  | "static-size-130"
  | "static-size-150"
  | "static-size-160"
  | "static-size-175"
  | "static-size-200"
  | "static-size-225"
  | "static-size-250"
  | "static-size-300"
  | "static-size-400"
  | "static-size-450"
  | "static-size-500"
  | "static-size-550"
  | "static-size-600"
  | "static-size-700"
  | "static-size-800"
  | "static-size-900"
  | "static-size-1000"
  | "static-size-1200"
  | "static-size-1700"
  | "static-size-2400"
  | "static-size-2600"
  | "static-size-3400"
  | "static-size-3600"
  | "static-size-4600"
  | "static-size-5000"
  | "static-size-6000"
  | "single-line-height"
  | "single-line-width"
  | number
  // This allows autocomplete to work properly and not collapse the above options into just `string`.
  // https://github.com/microsoft/TypeScript/issues/29729.
  | (string & {});

export type BorderRadiusValue = "small" | "medium";
export type BorderColorValue = "default" | "light" | "dark" | ColorValue;
export type BorderSizeValue = "thin" | "thick" | "thicker" | "thickest";
export type BackgroundColorValue = "light" | "dark" | ColorValue;

export interface StyleProps {
  /** Sets the CSS [className](https://developer.mozilla.org/en-US/docs/Web/API/Element/className) for the element. Only use as a **last resort**. **/
  className?: string;

  /** The margin for all four sides of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/margin). */
  margin?: Responsive<DimensionValue>;
  /** The margin for the logical start side of the element, depending on layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-inline-start). */
  marginStart?: Responsive<DimensionValue>;
  /** The margin for the logical end side of an element, depending on layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-inline-end). */
  marginEnd?: Responsive<DimensionValue>;
  // /** The margin for the left side of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-left). Consider using `marginStart` instead for RTL support. */
  // marginLeft?: Responsive<DimensionValue>,
  // /** The margin for the right side of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-left). Consider using `marginEnd` instead for RTL support. */
  // marginRight?: Responsive<DimensionValue>,
  /** The margin for the top side of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-top). */
  marginTop?: Responsive<DimensionValue>;
  /** The margin for the bottom side of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/margin-bottom). */
  marginBottom?: Responsive<DimensionValue>;
  /** The margin for both the left and right sides of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/margin). */
  marginX?: Responsive<DimensionValue>;
  /** The margin for both the top and bottom sides of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/margin). */
  marginY?: Responsive<DimensionValue>;

  /** The width of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/width). */
  width?: DimensionValue;
  /** The height of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/height). */
  height?: string | number;
  /** The minimum width of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/min-width). */
  minWidth?: string | number;
  /** The minimum height of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/min-height). */
  minHeight?: string | number;
  /** The maximum width of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/max-width). */
  maxWidth?: string | number;
  /** The maximum height of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/max-height). */
  maxHeight?: string | number;

  /** When used in a flex layout, specifies how the element will grow or shrink to fit the space available. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/flex). */
  flex?: Responsive<string | number | boolean>;
  /** When used in a flex layout, specifies how the element will grow to fit the space available. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-grow). */
  flexGrow?: Responsive<number>;
  /** When used in a flex layout, specifies how the element will shrink to fit the space available. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-shrink). */
  flexShrink?: Responsive<number>;
  /** When used in a flex layout, specifies the initial main size of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-basis). */
  flexBasis?: Responsive<number | string>;
  /** Specifies how the element is justified inside a flex or grid container. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-self). */
  justifySelf?: Responsive<
    | "auto"
    | "normal"
    | "start"
    | "end"
    | "flex-start"
    | "flex-end"
    | "self-start"
    | "self-end"
    | "center"
    | "left"
    | "right"
    | "stretch"
  >; // ...
  /** Overrides the `alignItems` property of a flex or grid container. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/align-self). */
  alignSelf?: Responsive<
    | "auto"
    | "normal"
    | "start"
    | "end"
    | "center"
    | "flex-start"
    | "flex-end"
    | "self-start"
    | "self-end"
    | "stretch"
  >;
  /** The layout order for the element within a flex or grid container. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/order). */
  order?: Responsive<number>;

  /** When used in a grid layout, specifies the named grid area that the element should be placed in within the grid. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-area). */
  gridArea?: Responsive<string>;
  /** When used in a grid layout, specifies the column the element should be placed in within the grid. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column). */
  gridColumn?: Responsive<string>;
  /** When used in a grid layout, specifies the row the element should be placed in within the grid. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-row). */
  gridRow?: Responsive<string>;
  /** When used in a grid layout, specifies the starting column to span within the grid. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column-start). */
  gridColumnStart?: Responsive<string>;
  /** When used in a grid layout, specifies the ending column to span within the grid. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column-end). */
  gridColumnEnd?: Responsive<string>;
  /** When used in a grid layout, specifies the starting row to span within the grid. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-row-start). */
  gridRowStart?: Responsive<string>;
  /** When used in a grid layout, specifies the ending row to span within the grid. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-row-end). */
  gridRowEnd?: Responsive<string>;

  /** Specifies how the element is positioned. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/position). */
  position?: Responsive<
    "static" | "relative" | "absolute" | "fixed" | "sticky"
  >;
  /** The stacking order for the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index). */
  zIndex?: Responsive<number>;
  /** The top position for the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/top). */
  top?: Responsive<DimensionValue>;
  /** The bottom position for the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/bottom). */
  bottom?: Responsive<DimensionValue>;
  /** The logical start position for the element, depending on layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/inset-inline-start). */
  start?: Responsive<DimensionValue>;
  /** The logical end position for the element, depending on layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/inset-inline-end). */
  end?: Responsive<DimensionValue>;
  /** The left position for the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/left). Consider using `start` instead for RTL support. */
  left?: Responsive<DimensionValue>;
  /** The right position for the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/right). Consider using `start` instead for RTL support. */
  right?: Responsive<DimensionValue>;

  /** Hides the element. */
  isHidden?: Responsive<boolean>;
}

// These support more properties than specific arize components
// but still based on arize global/alias variables.
export interface ViewStyleProps extends StyleProps {
  /** The background color for the element. */
  backgroundColor?: Responsive<BackgroundColorValue>;

  /** The width of the element's border on all four sides. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-width). */
  borderWidth?: Responsive<BorderSizeValue>;
  /** The width of the border on the logical start side, depending on the layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-start-width). */
  borderStartWidth?: Responsive<BorderSizeValue>;
  /** The width of the border on the logical end side, depending on the layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-end-width). */
  borderEndWidth?: Responsive<BorderSizeValue>;
  borderLeftWidth?: BorderSizeValue;
  borderRightWidth?: BorderSizeValue;
  /** The width of the top border. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-top-width). */
  borderTopWidth?: Responsive<BorderSizeValue>;
  /** The width of the bottom border. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-bottom-width). */
  borderBottomWidth?: Responsive<BorderSizeValue>;
  /** The width of the left and right borders. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-width). */
  borderXWidth?: Responsive<BorderSizeValue>;
  /** The width of the top and bottom borders. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-width). */
  borderYWidth?: Responsive<BorderSizeValue>;

  /** The color of the element's border on all four sides. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-color). */
  borderColor?: Responsive<BorderColorValue>;
  /** The color of the border on the logical start side, depending on the layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-start-color). */
  borderStartColor?: Responsive<BorderColorValue>;
  /** The color of the border on the logical end side, depending on the layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-inline-end-color). */
  borderEndColor?: Responsive<BorderColorValue>;
  // borderLeftColor?: BorderColorValue,
  // borderRightColor?: BorderColorValue,
  /** The color of the top border. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-top-color). */
  borderTopColor?: Responsive<BorderColorValue>;
  /** The color of the bottom border. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-bottom-color). */
  borderBottomColor?: Responsive<BorderColorValue>;
  /** The color of the left and right borders. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-color). */
  borderXColor?: Responsive<BorderColorValue>;
  /** The color of the top and bottom borders. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-width). */
  borderYColor?: Responsive<BorderColorValue>;

  /** The border radius on all four sides of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-radius). */
  borderRadius?: Responsive<BorderRadiusValue>;
  /** The border radius for the top start corner of the element, depending on the layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-start-start-radius). */
  borderTopStartRadius?: Responsive<BorderRadiusValue>;
  /** The border radius for the top end corner of the element, depending on the layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-start-end-radius). */
  borderTopEndRadius?: Responsive<BorderRadiusValue>;
  /** The border radius for the bottom start corner of the element, depending on the layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-end-start-radius). */
  borderBottomStartRadius?: Responsive<BorderRadiusValue>;
  /** The border radius for the bottom end corner of the element, depending on the layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/border-end-end-radius). */
  borderBottomEndRadius?: Responsive<BorderRadiusValue>;

  /** The padding for all four sides of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/padding). */
  padding?: Responsive<DimensionValue>;
  /** The padding for the logical start side of the element, depending on layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-inline-start). */
  paddingStart?: Responsive<DimensionValue>;
  /** The padding for the logical end side of an element, depending on layout direction. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-inline-end). */
  paddingEnd?: Responsive<DimensionValue>;
  // paddingLeft?: Responsive<DimensionValue>,
  // paddingRight?: Responsive<DimensionValue>,
  /** The padding for the top side of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-top). */
  paddingTop?: Responsive<DimensionValue>;
  /** The padding for the bottom side of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/padding-bottom). */
  paddingBottom?: Responsive<DimensionValue>;
  /** The padding for both the left and right sides of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/padding). */
  paddingX?: Responsive<DimensionValue>;
  /** The padding for both the top and bottom sides of the element. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/padding). */
  paddingY?: Responsive<DimensionValue>;

  /** Species what to do when the element's content is too long to fit its size. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow). */
  overflow?: Responsive<string>;
  // ...
  // shadows?
  // transforms?
}

export interface BoxAlignmentStyleProps {
  /**
   * The distribution of space around items along the main axis. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/justify-content).
   * @default 'stretch'
   */
  justifyContent?: Responsive<
    | "start"
    | "end"
    | "center"
    | "left"
    | "right"
    | "space-between"
    | "space-around"
    | "space-evenly"
    | "stretch"
    | "baseline"
    | "first baseline"
    | "last baseline"
    | "safe center"
    | "unsafe center"
  >;
  /**
   * The distribution of space around child items along the cross axis. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/align-content).
   * @default 'start'
   */
  alignContent?: Responsive<
    | "start"
    | "end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly"
    | "stretch"
    | "baseline"
    | "first baseline"
    | "last baseline"
    | "safe center"
    | "unsafe center"
  >;
  /**
   * The alignment of children within their container. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/align-items).
   * @default 'stretch'
   */
  alignItems?: Responsive<
    | "start"
    | "end"
    | "center"
    | "stretch"
    | "self-start"
    | "self-end"
    | "baseline"
    | "first baseline"
    | "last baseline"
    | "safe center"
    | "unsafe center"
  >;
  /** The space to display between both rows and columns. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/gap). */
  gap?: Responsive<DimensionValue>;
  /** The space to display between columns. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/column-gap). */
  columnGap?: Responsive<DimensionValue>;
  /** The space to display between rows. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/row-gap). */
  rowGap?: Responsive<DimensionValue>;
}

export type ResponsiveProp<T> = {
  base?: T;
  S?: T;
  M?: T;
  L?: T;
  [custom: string]: T | undefined;
};

export interface FlexStyleProps extends BoxAlignmentStyleProps, StyleProps {
  /**
   * The direction in which to layout children. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-direction).
   * @default 'row'
   */
  direction?: Responsive<"row" | "column" | "row-reverse" | "column-reverse">;
  /**
   * Whether to wrap items onto multiple lines. See [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-wrap).
   * @default false
   */
  wrap?: Responsive<boolean | "wrap" | "nowrap" | "wrap-reverse">;
}

export type Responsive<T> = T | ResponsiveProp<T>;

export type TextColorValue =
  | "text-900"
  | "text-800"
  | "text-700"
  | "text-600"
  | "text-500"
  | "text-400"
  | "text-300"
  | "text-200"
  | "text-100"
  | "inherit"
  | ColorValue;

/**
 * Makes a component stylable with emotion in addition to the component's styles.
 * To be used sparingly when a component needs to be styled for very specific use cases.
 */
export interface StylableProps {
  /**
   * Take an emotion css prop to be merged after the component's styles.
   */
  css?: SerializedStyles;
}
