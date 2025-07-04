import { forwardRef, ReactNode, Ref } from "react";
import { Tooltip as AriaTooltip } from "react-aria-components";
import { css } from "@emotion/react";

import { Heading, Text, View } from "@phoenix/components";

import { richTooltipCSS } from "./styles";
import { TooltipProps } from "./types";
export interface RichTooltipProps extends TooltipProps {}

function RichTooltip(props: RichTooltipProps, ref: Ref<HTMLDivElement>) {
  const { children, css: propCSS, ...otherProps } = props;

  return (
    <AriaTooltip {...otherProps} ref={ref} css={css(richTooltipCSS, propCSS)}>
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
