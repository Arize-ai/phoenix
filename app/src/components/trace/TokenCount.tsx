import { css } from "@emotion/react";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Flex, Icon, Icons, Text, TextProps } from "@phoenix/components";

type TokenCountProps = {
  /**
   * The total number of tokens in the prompt and completion
   */
  tokenCountTotal: number;
  /**
   * The number of tokens in the prompt
   */
  tokenCountPrompt: number;
  /**
   * The number of tokens in the completion
   */
  tokenCountCompletion: number;
  /**
   * The size of the icon and text
   */
  size?: TextProps["size"];
};

/**
 * Displays the number of tokens in the prompt and completion
 */
export function TokenCount(props: TokenCountProps) {
  return (
    <TooltipTrigger>
      <TriggerWrap>
        <TokenItem size={props.size}>{props.tokenCountTotal}</TokenItem>
      </TriggerWrap>
      <Tooltip>
        <Flex direction="column" gap="size-50">
          <Flex direction="row" gap="size-100" justifyContent="space-between">
            prompt tokens
            <TokenItem>{props.tokenCountPrompt}</TokenItem>
          </Flex>
          <Flex direction="row" gap="size-100" justifyContent="space-between">
            completion tokens
            <TokenItem>{props.tokenCountCompletion}</TokenItem>
          </Flex>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}

function TokenItem({
  children,
  ...textProps
}: {
  children: number;
  size?: TextProps["size"];
}) {
  return (
    <Flex
      direction="row"
      gap="size-50"
      alignItems="center"
      className="token-count-item"
    >
      <Icon
        svg={<Icons.TokensOutline />}
        css={css`
          color: var(--ac-global-text-color-900);
        `}
      />
      <Text {...textProps}>{children}</Text>
    </Flex>
  );
}
