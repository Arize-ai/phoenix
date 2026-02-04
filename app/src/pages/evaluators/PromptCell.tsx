import type { ReactNode } from "react";
import { css } from "@emotion/react";

import { Flex, Link, Text, Token } from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

export const PromptCell = ({
  prompt,
  promptVersionTag,
  wrapWidth,
}: {
  prompt?: { id: string; name: string };
  promptVersionTag?: string;
  /**
   * When set, constrains the component to a max-width (in pixels) and allows
   * the content to wrap onto two lines if needed. When undefined, the component
   * displays inline without wrapping.
   */
  wrapWidth?: number;
}) => {
  if (!prompt) {
    return null;
  }
  return (
    <PromptLink
      promptId={prompt.id}
      promptName={prompt.name}
      promptVersionTag={promptVersionTag}
      wrapWidth={wrapWidth}
    />
  );
};

export const PromptLink = ({
  promptId,
  promptName,
  promptVersionTag,
  wrapWidth,
}: {
  promptId: string;
  promptName: string;
  promptVersionTag?: string;
  /**
   * When set, constrains the component to a max-width (in pixels) and allows
   * the content to wrap onto two lines if needed. When undefined, the component
   * displays inline without wrapping.
   */
  wrapWidth?: number;
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
        ${wrapWidth != null &&
        css`
          max-width: ${wrapWidth}px;
        `}
      `}
    >
      <Flex
        alignItems="center"
        wrap={wrapWidth != null ? "wrap" : undefined}
        gap={wrapWidth != null ? "size-50" : undefined}
      >
        <Truncate maxWidth={wrapWidth != null ? "100%" : "10rem"}>
          {promptName}
        </Truncate>
        <Flex alignItems="center">
          <Text color="text-300">
            {wrapWidth != null ? "@\u00A0" : "\u00A0@\u00A0"}
          </Text>
          {specifier}
        </Flex>
      </Flex>
    </Link>
  );
};
