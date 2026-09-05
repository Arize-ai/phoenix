import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { MarkdownDisplayProvider } from "@phoenix/components/markdown";
import { PreferencesProvider } from "@phoenix/contexts";
import { ReasoningMessageContent } from "@phoenix/pages/trace/span/ReasoningMessageContent";

const containerCSS = css`
  width: 100%;
  max-width: 700px;
`;

/**
 * A reasoning (thinking) part of a traced LLM message, rendered inside the
 * message card's contents list. The block is set apart from the answer so a
 * reader can tell what the model thought from what it said, and it still
 * appears when the provider returned the reasoning as an opaque payload.
 */
const meta: Meta<typeof ReasoningMessageContent> = {
  title: "Trace/ReasoningMessageContent",
  component: ReasoningMessageContent,
  decorators: [
    // the markdown mode the block renders in is a user preference
    (Story) => (
      <PreferencesProvider>
        <MarkdownDisplayProvider>
          <div css={containerCSS}>
            <Story />
          </div>
        </MarkdownDisplayProvider>
      </PreferencesProvider>
    ),
  ],
  parameters: {
    controls: { disable: true },
  },
};

export default meta;

type Story = StoryObj<typeof ReasoningMessageContent>;

const summaryText =
  "**Analyzing train speeds and catch-up time**\n\nOkay, let’s break this down: we have two trains. The first train travels at 60 mph, and the second at 90 mph, leaving 2 hours later. Let t be the time since the first train left. The first train will have traveled 60t, while the second will have traveled 90(t-2). Setting these equal, I can solve for t.\n\n**Finding catch-up time**\n\n60t = 90(t-2) gives t = 6 hours. So they catch up 6 hours after the first train leaves. That's my final answer!";

/**
 * OpenAI Responses reasoning with a detailed summary: the summary renders as
 * markdown and the item id can be copied from the header.
 */
export const WithSummary: Story = {
  args: {
    content: {
      type: "reasoning",
      id: "rs_05adbc9464d80cf8006a9b13e3760487d198f1e0f8c010edd6",
      text: summaryText,
      encrypted_content:
        "gAAAAABqmxPpvCVcArWWTGBFOpCB2mW1owPGWS_cY7D9UX0Bu7fX…",
    },
  },
};

/**
 * OpenAI Responses reasoning traced without a summary: only the encrypted
 * payload arrived, so the block says why there is nothing to read.
 */
export const EncryptedOnly: Story = {
  args: {
    content: {
      type: "reasoning",
      id: "rs_05adbc9464d80cf8006a9b13ec2eb887d1afa01719eb1114e7",
      encrypted_content:
        "gAAAAABqmxPvAH5lozSRfQgLaqQ6-e9nbGDCbEZGlyA_nuAfH_vo…",
    },
  },
};

/**
 * Anthropic redacted thinking: the provider withheld the text and sent an
 * opaque data payload in its place.
 */
export const Redacted: Story = {
  args: {
    content: {
      type: "reasoning",
      data: "EmwKAhgBEgy3va3pzix/LafPsn4aDFIT2Xlxh0L5L8rLVyIwxtE3rAFBa8cr3qpP…",
    },
  },
};

/**
 * Gemini thinking that carried only a thought signature — nothing to display
 * and no id to copy.
 */
export const SignatureOnly: Story = {
  args: {
    content: {
      type: "reasoning",
      signature: "CiQBVKhc7pXhRr5g0bOZ4Jz…",
    },
  },
};

/**
 * Anthropic extended thinking: readable thinking text with a signature but no
 * provider item id, so the header carries no copy button.
 */
export const ThinkingWithoutId: Story = {
  args: {
    content: {
      type: "reasoning",
      text: "The user wants the duration in minutes. 6 hours × 60 = 360 minutes. I should restate the answer briefly.",
      signature: "ErUBCkYIBBgCIkDnZ0o4…",
    },
  },
};
