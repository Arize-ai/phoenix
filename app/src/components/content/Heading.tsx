import { css } from "@emotion/react";
import type { Ref } from "react";
import { forwardRef } from "react";
import type { HeadingProps as AriaHeadingProps } from "react-aria-components";
import { Heading as AriaHeading } from "react-aria-components";

import { classNames } from "@phoenix/utils";

import { headingBaseCSS, textBaseCSS } from "./styles";
import type { Weight } from "./types";

export interface HeadingProps extends AriaHeadingProps {
  /**
   * Sets the font weight
   * @default 'normal'
   */
  weight?: Weight;
}

/**
 * Heading is used to create various levels of typographic hierarchies.
 */
function Heading(props: HeadingProps, ref: Ref<HTMLHeadingElement>) {
  const { children, level = 3, weight = "normal", ...otherProps } = props;

  return (
    <AriaHeading
      {...otherProps}
      css={css(textBaseCSS, headingBaseCSS)}
      className={classNames("ac-Heading", props.className)}
      ref={ref}
      level={level}
      data-level={level}
      data-weight={weight}
    >
      {children}
    </AriaHeading>
  );
}

const _Heading = forwardRef(Heading);
export { _Heading as Heading };
