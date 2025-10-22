import { CSSProperties, HTMLAttributes } from "react";
import { useLocale } from "react-aria-components";

import {
  BackgroundColorValue,
  BorderColorValue,
  BorderRadiusValue,
  BorderSizeValue,
  ColorValue,
  DimensionValue,
  Direction,
  Responsive,
  ResponsiveProp,
  StyleProps,
  ViewStyleProps,
} from "../types";

type Breakpoint = "base" | "S" | "M" | "L" | string;
type StyleName = string | string[] | ((dir: Direction) => string);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StyleHandler<T = any> = (value: T) => string | undefined;
export interface StyleHandlers {
  [key: string]: [StyleName, StyleHandler];
}

export const baseStyleProps: StyleHandlers = {
  margin: ["margin", dimensionValue],
  marginStart: [rtl("marginLeft", "marginRight"), dimensionValue],
  marginEnd: [rtl("marginRight", "marginLeft"), dimensionValue],
  // marginLeft: ['marginLeft', dimensionValue],
  // marginRight: ['marginRight', dimensionValue],
  marginTop: ["marginTop", dimensionValue],
  marginBottom: ["marginBottom", dimensionValue],
  marginX: [["marginLeft", "marginRight"], dimensionValue],
  marginY: [["marginTop", "marginBottom"], dimensionValue],
  width: ["width", dimensionValue],
  height: ["height", dimensionValue],
  minWidth: ["minWidth", dimensionValue],
  minHeight: ["minHeight", dimensionValue],
  maxWidth: ["maxWidth", dimensionValue],
  maxHeight: ["maxHeight", dimensionValue],
  isHidden: ["display", hiddenValue],
  alignSelf: ["alignSelf", passthroughStyle],
  justifySelf: ["justifySelf", passthroughStyle],
  position: ["position", anyValue],
  zIndex: ["zIndex", anyValue],
  top: ["top", dimensionValue],
  bottom: ["bottom", dimensionValue],
  start: [rtl("left", "right"), dimensionValue],
  end: [rtl("right", "left"), dimensionValue],
  left: ["left", dimensionValue],
  right: ["right", dimensionValue],
  order: ["order", anyValue],
  flex: ["flex", flexValue],
  flexGrow: ["flexGrow", passthroughStyle],
  flexShrink: ["flexShrink", passthroughStyle],
  flexBasis: ["flexBasis", passthroughStyle],
  gridArea: ["gridArea", passthroughStyle],
  gridColumn: ["gridColumn", passthroughStyle],
  gridColumnEnd: ["gridColumnEnd", passthroughStyle],
  gridColumnStart: ["gridColumnStart", passthroughStyle],
  gridRow: ["gridRow", passthroughStyle],
  gridRowEnd: ["gridRowEnd", passthroughStyle],
  gridRowStart: ["gridRowStart", passthroughStyle],
};

export const viewStyleProps: StyleHandlers = {
  ...baseStyleProps,
  backgroundColor: ["backgroundColor", backgroundColorValue],
  borderWidth: ["borderWidth", borderSizeValue],
  borderStartWidth: [
    rtl("borderLeftWidth", "borderRightWidth"),
    borderSizeValue,
  ],
  borderEndWidth: [rtl("borderRightWidth", "borderLeftWidth"), borderSizeValue],
  borderLeftWidth: ["borderLeftWidth", borderSizeValue],
  borderRightWidth: ["borderRightWidth", borderSizeValue],
  borderTopWidth: ["borderTopWidth", borderSizeValue],
  borderBottomWidth: ["borderBottomWidth", borderSizeValue],
  borderXWidth: [["borderLeftWidth", "borderRightWidth"], borderSizeValue],
  borderYWidth: [["borderTopWidth", "borderBottomWidth"], borderSizeValue],
  borderColor: ["borderColor", borderColorValue],
  borderStartColor: [
    rtl("borderLeftColor", "borderRightColor"),
    borderColorValue,
  ],
  borderEndColor: [
    rtl("borderRightColor", "borderLeftColor"),
    borderColorValue,
  ],
  borderLeftColor: ["borderLeftColor", borderColorValue],
  borderRightColor: ["borderRightColor", borderColorValue],
  borderTopColor: ["borderTopColor", borderColorValue],
  borderBottomColor: ["borderBottomColor", borderColorValue],
  borderXColor: [["borderLeftColor", "borderRightColor"], borderColorValue],
  borderYColor: [["borderTopColor", "borderBottomColor"], borderColorValue],
  borderRadius: ["borderRadius", borderRadiusValue],
  borderTopStartRadius: [
    rtl("borderTopLeftRadius", "borderTopRightRadius"),
    borderRadiusValue,
  ],
  borderTopEndRadius: [
    rtl("borderTopRightRadius", "borderTopLeftRadius"),
    borderRadiusValue,
  ],
  borderBottomStartRadius: [
    rtl("borderBottomLeftRadius", "borderBottomRightRadius"),
    borderRadiusValue,
  ],
  borderBottomEndRadius: [
    rtl("borderBottomRightRadius", "borderBottomLeftRadius"),
    borderRadiusValue,
  ],
  borderTopLeftRadius: ["borderTopLeftRadius", borderRadiusValue],
  borderTopRightRadius: ["borderTopRightRadius", borderRadiusValue],
  borderBottomLeftRadius: ["borderBottomLeftRadius", borderRadiusValue],
  borderBottomRightRadius: ["borderBottomRightRadius", borderRadiusValue],
  padding: ["padding", dimensionValue],
  paddingStart: [rtl("paddingLeft", "paddingRight"), dimensionValue],
  paddingEnd: [rtl("paddingRight", "paddingLeft"), dimensionValue],
  paddingLeft: ["paddingLeft", dimensionValue],
  paddingRight: ["paddingRight", dimensionValue],
  paddingTop: ["paddingTop", dimensionValue],
  paddingBottom: ["paddingBottom", dimensionValue],
  paddingX: [["paddingLeft", "paddingRight"], dimensionValue],
  paddingY: [["paddingTop", "paddingBottom"], dimensionValue],
  overflow: ["overflow", passthroughStyle],
};

const borderStyleProps = {
  borderWidth: "borderStyle",
  borderLeftWidth: "borderLeftStyle",
  borderRightWidth: "borderRightStyle",
  borderTopWidth: "borderTopStyle",
  borderBottomWidth: "borderBottomStyle",
};

const UNIT_RE =
  /(%|px|em|rem|vw|vh|auto|cm|mm|in|pt|pc|ex|ch|rem|vmin|vmax|fr)$/;
const FUNC_RE = /^\s*\w+\(/;
const AC_VARIABLE_RE = /(static-)?size-\d+|single-line-(height|width)/g;

export function dimensionValue(value: DimensionValue) {
  if (typeof value === "number") {
    return value + "px";
  }

  if (UNIT_RE.test(value)) {
    return value;
  }

  if (FUNC_RE.test(value)) {
    return value.replace(AC_VARIABLE_RE, "var(--ac-global-dimension-$&)");
  }

  return `var(--ac-global-dimension-${value})`;
}

export function responsiveDimensionValue(
  value: Responsive<DimensionValue>,
  matchedBreakpoints: Breakpoint[]
) {
  value = getResponsiveProp(value, matchedBreakpoints);
  return dimensionValue(value);
}

export function convertStyleProps(
  props: ViewStyleProps,
  handlers: StyleHandlers,
  direction: Direction,
  matchedBreakpoints: Breakpoint[]
) {
  const style: CSSProperties = {};
  for (const key in props) {
    const styleProp = handlers[key];
    // @ts-expect-error - allow key access view style props
    if (!styleProp || props[key] == null) {
      continue;
    }

    // eslint-disable-next-line prefer-const
    let [name, convert] = styleProp;
    if (typeof name === "function") {
      name = name(direction);
    }

    const prop = getResponsiveProp(
      props[key as keyof ViewStyleProps],
      matchedBreakpoints
    );
    const value = convert(prop);
    if (Array.isArray(name)) {
      for (const k of name) {
        // @ts-expect-error - allow key access view style props
        style[k] = value;
      }
    } else {
      // @ts-expect-error - allow key access view style props
      style[name] = value;
    }
  }

  for (const prop in borderStyleProps) {
    if (style[prop as keyof typeof borderStyleProps]) {
      // @ts-expect-error - allow key access view style props
      style[borderStyleProps[prop as keyof typeof borderStyleProps]] = "solid";
      style.boxSizing = "border-box";
    }
  }

  return style;
}

function rtl(ltr: string, rtl: string) {
  return (direction: Direction) => (direction === "rtl" ? rtl : ltr);
}

type ColorType = "default" | "background" | "border" | "icon" | "status";
export function colorValue(value: ColorValue, type: ColorType = "default") {
  // TODO actually support semantic colors
  return `var(--ac-global-color-${value}, var(--ac-semantic-${value}-color-${type}))`;
}

function backgroundColorValue(value: BackgroundColorValue) {
  return `var(--ac-global-background-color-${value}, ${colorValue(
    value as ColorValue,
    "background"
  )})`;
}

function borderColorValue(value: BorderColorValue) {
  // TODO support default color
  if (value === "default") {
    return "var(--ac-global-border-color)";
  }

  return `var(--ac-global-border-color-${value}, ${colorValue(
    value as ColorValue,
    "border"
  )})`;
}

function borderSizeValue(value: BorderSizeValue) {
  return `var(--ac-global-border-size-${value})`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function passthroughStyle(value: any) {
  return value;
}

function borderRadiusValue(value: BorderRadiusValue) {
  return `var(--ac-global-rounding-${value})`;
}

function hiddenValue(value: boolean) {
  return value ? "none" : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function anyValue(value: any) {
  return value;
}

function flexValue(value: boolean | number | string) {
  if (typeof value === "boolean") {
    return value ? "1" : undefined;
  }

  return "" + value;
}

export function getResponsiveProp<T>(
  prop: Responsive<T>,
  matchedBreakpoints: Breakpoint[]
): T {
  if (prop && typeof prop === "object" && !Array.isArray(prop)) {
    for (let i = 0; i < matchedBreakpoints.length; i++) {
      const breakpoint = matchedBreakpoints[i];
      // @ts-expect-error - allow key access view style props
      if (prop[breakpoint] != null) {
        // @ts-expect-error - allow key access view style props
        return prop[breakpoint];
      }
    }
    return (prop as ResponsiveProp<T>).base as T;
  }
  return prop as T;
}

type StylePropsOptions = {
  matchedBreakpoints?: Breakpoint[];
};

export function filterStyleProps<T extends StyleProps>(
  props: T,
  handlers: StyleHandlers = baseStyleProps
) {
  const filtered = { ...props };
  for (const key in handlers) {
    delete filtered[key as keyof T];
  }
  return filtered;
}

export function useStyleProps<T extends StyleProps>(
  props: T,
  handlers: StyleHandlers = baseStyleProps,
  options: StylePropsOptions = {}
) {
  const { direction } = useLocale();
  const { matchedBreakpoints = ["base"] } = options;
  const styles = convertStyleProps(
    props,
    handlers,
    direction,
    matchedBreakpoints
  );
  const style = { ...styles };

  const styleProps: HTMLAttributes<HTMLElement> = {
    style,
  };

  if (getResponsiveProp(props.isHidden, matchedBreakpoints)) {
    styleProps.hidden = true;
  }

  const otherProps = filterStyleProps(props, handlers);

  return {
    styleProps,
    otherProps,
  };
}
