import type { ReactNode } from "react";
import { css } from "@emotion/react";

import { Flex, Link, Text, Token } from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

export const PromptCell = ({
  prompt,
  promptVersionTag,
}: {
  prompt?: { id: string; name: string };
  promptVersionTag?: string;
}) => {
  if (!prompt) {
    return null;
  }
  return (
    <PromptLink
      promptId={prompt.id}
      promptName={prompt.name}
      promptVersionTag={promptVersionTag}
    />
  );
};

export const PromptLink = ({
  promptId,
  promptName,
  promptVersionTag,
}: {
  promptId: string;
  promptName: string;
  promptVersionTag?: string;
}) => {
  let to: string;
  let specifier: ReactNode;
  // if tag exists, that means the evaluator is pinned to a specific version of the prompt
  // otherwise, we assume the latest version is pinned
  if (promptVersionTag) {
    specifier = (
      <Token size="S" color="var(--ac-global-color-grey-700)">
        <Truncate maxWidth="10rem">{promptVersionTag}</Truncate>
      </Token>
    );
    to = `/redirects/prompts/${promptId}/tags/${encodeURIComponent(promptVersionTag)}`;
  } else {
    specifier = (
      <Token size="S" color="var(--ac-global-color-grey-700)">
        latest
      </Token>
    );
    to = `/prompts/${promptId}`;
  }
  return (
    <Link
      to={to}
      css={css`
        text-decoration: none;
      `}
    >
      <Flex alignItems="center">
        <Truncate maxWidth="10rem">{promptName}</Truncate>
        <Text color="text-300">&nbsp;@&nbsp;</Text>
        {specifier}
      </Flex>
    </Link>
  );
};
