import { css } from "@emotion/react";
import type { HTMLAttributes, Ref } from "react";

import type { TextProps } from "@phoenix/components";
import { Icon, Icons, Text } from "@phoenix/components";
import { getTextColor } from "@phoenix/components/core/content/textUtils";
import { formatNumber } from "@phoenix/utils/numberFormatUtils";

const tokenCountItemCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-static-size-50);
  align-items: center;

  &[data-size="S"] {
    font-size: var(--global-font-size-s);
  }
  &[data-size="M"] {
    font-size: var(--global-font-size-m);
  }
`;

interface TokenCountProps extends HTMLAttributes<HTMLDivElement> {
  children: number | null | undefined;
  size?: TextProps["size"];
  color?: TextProps["color"];
}

function TokenCount({
  ref,
  ...props
}: TokenCountProps & { ref?: Ref<HTMLDivElement> }) {
  const { children, color = "text-900", size = "M", ...otherProps } = props;

  // color match text with icon
  const appliedColor = getTextColor(color);
  const text = typeof children === "number" ? formatNumber(children) : "--";
  return (
    <div
      className="token-count-item"
      data-size={size}
      css={tokenCountItemCSS}
      ref={ref}
      {...otherProps}
    >
      <Icon
        svg={<Icons.TokensOutline />}
        css={css`
          color: ${appliedColor};
        `}
      />
      <Text size={props.size} color={color} fontFamily="mono">
        {text}
      </Text>
    </div>
  );
}

export { TokenCount };
