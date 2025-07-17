import { forwardRef, ReactNode, Ref } from "react";
import { filterDOMProps } from "@react-aria/utils";
import { css } from "@emotion/react";

import { classNames } from "@arizeai/components";

import { DOMProps, FlexStyleProps } from "@phoenix/components/types";
import {
  passthroughStyle,
  responsiveDimensionValue,
  StyleHandlers,
  useStyleProps,
} from "@phoenix/components/utils";

export interface FlexProps extends DOMProps, FlexStyleProps {
  /** Children of the flex container. */
  children: ReactNode;
}

const flexCSS = css`
  display: flex;
`;

const flexStyleProps: StyleHandlers = {
  direction: ["flexDirection", passthroughStyle],
  wrap: ["flexWrap", flexWrapValue],
  justifyContent: ["justifyContent", flexAlignValue],
  alignItems: ["alignItems", flexAlignValue],
  alignContent: ["alignContent", flexAlignValue],
};

function Flex(props: FlexProps, ref: Ref<HTMLDivElement>) {
  const { children, className, ...otherProps } = props;

  const matchedBreakpoints = ["base"];
  const { styleProps } = useStyleProps(otherProps);
  const { styleProps: flexStyle } = useStyleProps(otherProps, flexStyleProps);

  // If no gaps, or native support exists, then we only need to render a single div.
  const style = {
    ...styleProps.style,
    ...flexStyle.style,
  };

  if (props.gap != null) {
    style.gap = responsiveDimensionValue(props.gap, matchedBreakpoints);
  }

  if (props.columnGap != null) {
    style.columnGap = responsiveDimensionValue(
      props.columnGap,
      matchedBreakpoints
    );
  }

  if (props.rowGap != null) {
    style.rowGap = responsiveDimensionValue(props.rowGap, matchedBreakpoints);
  }

  return (
    <div
      css={flexCSS}
      {...filterDOMProps(otherProps)}
      className={classNames("flex", className)}
      style={style}
      ref={ref}
    >
      {children}
    </div>
  );
}

/**
 * Normalize 'start' and 'end' alignment values to 'flex-start' and 'flex-end'
 * in flex containers for browser compatibility.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flexAlignValue(value: any) {
  if (value === "start") {
    return "flex-start";
  }

  if (value === "end") {
    return "flex-end";
  }

  return value;
}

/**
 * Takes a boolean and translates it to flex wrap or nowrap.
 */
function flexWrapValue(value: boolean | "wrap" | "nowrap") {
  if (typeof value === "boolean") {
    return value ? "wrap" : "nowrap";
  }

  return value;
}

/**
 * A layout container using flexbox. Provides dimension values, and supports the gap
 * property to define consistent spacing between items.
 */
const _Flex = forwardRef(Flex);
export { _Flex as Flex };
