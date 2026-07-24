import { css } from "@emotion/react";

import { View } from "@phoenix/components";

import { CopyToClipboardWrap } from "./CopyToClipboardWrap";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";

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
            <View
              backgroundColor="gray-100"
              borderColor="gray-300"
              borderWidth="thin"
              borderRadius="medium"
              padding="size-100"
            >
              <CopyToClipboardWrap text={prompt}>
                <MimeTypeCodeBlock value={prompt} mimeType="text" />
              </CopyToClipboardWrap>
            </View>
          </li>
        );
      })}
    </ul>
  );
}
