import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, TextProps } from "@phoenix/components";

const tokenCountItemCSS = css`
  &[data-size="S"] {
    font-size: var(--ac-global-font-size-s);
  }
  &[data-size="M"] {
    font-size: var(--ac-global-font-size-m);
  }
`;
export function TokenCount(props: {
  children: number | null | undefined;
  size?: TextProps["size"];
}) {
  const size = props.size ?? "M";
  const text = typeof props.children === "number" ? props.children : "--";
  return (
    <Flex
      direction="row"
      gap="size-50"
      alignItems="center"
      className="token-count-item"
      data-size={size}
      css={tokenCountItemCSS}
    >
      <Icon
        svg={<Icons.TokensOutline />}
        css={css`
          color: var(--ac-global-text-color-900);
        `}
      />
      <Text size={props.size}>{text}</Text>
    </Flex>
  );
}
