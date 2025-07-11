import { CSSProperties, forwardRef, ReactNode, Ref } from "react";
import { Tooltip as AriaTooltip } from "react-aria-components";
import { css } from "@emotion/react";

import { Heading, Text, View } from "@phoenix/components";

import { richTooltipCSS } from "./styles";
import { TooltipProps } from "./types";
export interface RichTooltipProps extends TooltipProps {
  /**
   * The width of the tooltip. If not provided, the tooltip will grow up to 300px to fit the content.
   */
  width?: CSSProperties["width"];
}

/**
 * RichTooltip component
 *
 * Use this component for tooltips that require rich content, such as description lists, charts, titles with paragraphs, or other complex layouts.
 * Ideal when you need more than a short sentence. If you only need a simple, brief tooltip, use the Tooltip component instead.
 */
function RichTooltip(props: RichTooltipProps, ref: Ref<HTMLDivElement>) {
  const { children, css: propCSS, width, ...otherProps } = props;

  return (
    <AriaTooltip
      {...otherProps}
      ref={ref}
      css={css(richTooltipCSS, propCSS)}
      style={width ? { width } : { maxWidth: "300px" }}
    >
      {children}
    </AriaTooltip>
  );
}

const _RichTooltip = forwardRef(RichTooltip);
export { _RichTooltip as RichTooltip };

// Composition components
export function RichTooltipTitle({ children }: { children: ReactNode }) {
  return (
    <Heading
      level={4}
      css={css`
        margin-bottom: var(--ac-global-dimension-static-size-100);
      `}
    >
      {children}
    </Heading>
  );
}

export function RichTooltipDescription({ children }: { children: ReactNode }) {
  return (
    <Text
      size="S"
      color="text-700"
      css={css`
        margin-bottom: var(--ac-global-dimension-static-size-100);
      `}
    >
      {children}
    </Text>
  );
}

export function RichTooltipActions({ children }: { children: ReactNode }) {
  return <View paddingTop="size-50">{children}</View>;
}
