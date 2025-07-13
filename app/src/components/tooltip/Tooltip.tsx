import { forwardRef, Ref } from "react";
import { Tooltip as AriaTooltip } from "react-aria-components";
import { css } from "@emotion/react";

import { tooltipCSS } from "./styles";
import { TooltipProps } from "./types";

/**
 * Tooltip component
 *
 * Use this component for simple tooltips that display short sentences or brief information.
 * Ideal for single-line or very concise text. For more complex content (e.g., description lists, charts, titles with paragraphs), use the RichTooltip component instead.
 */
function Tooltip(props: TooltipProps, ref: Ref<HTMLDivElement>) {
  const { css: propCSS, ...otherProps } = props;

  return (
    <AriaTooltip {...otherProps} ref={ref} css={css(tooltipCSS, propCSS)} />
  );
}

const _Tooltip = forwardRef(Tooltip);
export { _Tooltip as Tooltip };
