import { css } from "@emotion/react";

import {
  Card,
  CopyToClipboardButton,
  Counter,
  Text,
} from "@phoenix/components";

import { defaultCardProps } from "./constants";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";

/**
 * A single raw prompt sent to the LLM, as a card so its copy button sits in the
 * same place as every other card's.
 */
function LLMPrompt({ prompt, index }: { prompt: string; index: number }) {
  return (
    <Card
      {...defaultCardProps}
      backgroundColor="gray-100"
      borderColor="gray-300"
      title={<Text weight="heavy">Prompt</Text>}
      titleExtra={<Counter>#{index + 1}</Counter>}
      extra={<CopyToClipboardButton text={prompt} />}
    >
      <MimeTypeCodeBlock value={prompt} mimeType="text" />
    </Card>
  );
}

/**
 * A list of the raw prompts sent to the LLM.
 */
export function LLMPromptsList({ prompts }: { prompts: string[] }) {
  return (
    <ul
      data-testid="llm-prompts-list"
      css={css`
        padding: var(--global-dimension-size-200);
        display: flex;
        flex-direction: column;
        gap: var(--global-dimension-size-100);
      `}
    >
      {prompts.map((prompt, idx) => {
        return (
          <li key={idx}>
            <LLMPrompt prompt={prompt} index={idx} />
          </li>
        );
      })}
    </ul>
  );
}
