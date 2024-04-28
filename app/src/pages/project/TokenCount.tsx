import React from "react";
import { css } from "@emotion/react";

import {
  Flex,
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

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
};

/**
 * Displays the number of tokens in the prompt and completion
 */
export function TokenCount(props: TokenCountProps) {
  return (
    <TooltipTrigger>
      <TriggerWrap>
        <TokenItem>{props.tokenCountTotal}</TokenItem>
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

function TokenItem({ children }: { children: number }) {
  return (
    <Flex direction="row" gap="size-25" alignItems="center">
      <Icon
        svg={<Icons.TokensOutline />}
        css={css`
          color: var(--ac-global-text-color-900);
        `}
      />
      <Text>{children}</Text>
    </Flex>
  );
}
