import { forwardRef, JSXElementConstructor, ReactNode, Ref } from "react";
import { filterDOMProps } from "@react-aria/utils";
import { css } from "@emotion/react";

import { DOMProps, ViewStyleProps } from "@phoenix/components/types";

import { useStyleProps, viewStyleProps } from "../utils";

export interface ViewProps extends ViewStyleProps, DOMProps {
  /**
   * The children to be displayed in the View.
   */
  children?: ReactNode;
  /**
   * The element to render as the node.
   * @default 'div'
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elementType?: string | JSXElementConstructor<any>;
}

function View(props: ViewProps, ref: Ref<HTMLElement>) {
  const { children, elementType: ElementType = "div", ...otherProps } = props;
  const { styleProps } = useStyleProps(props, viewStyleProps);

  return (
    <ElementType
      {...filterDOMProps(otherProps)}
      {...styleProps}
      ref={ref}
      css={css`
        overflow: hidden;
        box-sizing: border-box;
      `}
      className="ac-view"
    >
      {children}
    </ElementType>
  );
}

/**
 * View is a general purpose container with no specific semantics
 * that can be used for custom styling purposes, similar to a div.
 */
const _View = forwardRef(View);
export { _View as View };
