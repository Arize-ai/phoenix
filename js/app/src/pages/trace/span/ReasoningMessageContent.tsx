import {
  MessageContentsAttributePostfixes,
  type SemanticAttributePrefixes,
} from "@arizeai/openinference-semantic-conventions";
import { css } from "@emotion/react";

import {
  CopyToClipboardButton,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Text,
} from "@phoenix/components";
import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";
import { ConnectedMarkdownBlock } from "@phoenix/components/markdown";
import type { AttributeMessageContent } from "@phoenix/openInference/tracing/types";
import { formatContentAsString } from "@phoenix/utils/jsonUtils";

import { getReasoningPreview } from "./utils";

/**
 * The attributes of a single content part, i.e. the value under the
 * `message_content` key of a message's `contents` list.
 */
type MessageContentAttributes =
  AttributeMessageContent[typeof SemanticAttributePrefixes.message_content];

const reasoningMessageContentCSS = css`
  width: 100%;

  /* a long first line is one unbreakable token; in a narrow drawer it has to
     give way to an ellipsis rather than push the copy button out of the card,
     so the rows between the trigger and that text release the minimum width
     they would otherwise take */
  .reasoning-message-content__heading {
    flex: 1 1 auto;
    min-width: 0;
  }
  .reasoning-message-content__label {
    flex: none;
  }
  .reasoning-message-content__preview {
    flex: 1 1 auto;
    min-width: 0;
    ${truncateSingleCSS};
    /* the trigger is a button, which centers its text; the excerpt reads on
       from the label instead */
    text-align: start;
  }
  /* an open row shows the real thing, so the excerpt only earns its place
     while the row is closed */
  &[data-expanded] .reasoning-message-content__preview {
    display: none;
  }
  /* thinking reads as secondary to the answer that follows it */
  .reasoning-message-content__panel {
    color: var(--global-text-color-700);
    padding: var(--global-dimension-size-200);
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-150);
  }
`;

/**
 * What a provider sends in place of reasoning text, in the order a part is
 * checked: OpenAI encrypts it, Anthropic redacts it, Gemini may attach only a
 * thought signature. The label names the kind in the closed row; the
 * description says why there is nothing to read once the row is open.
 */
const OPAQUE_REASONING_KINDS = [
  {
    key: MessageContentsAttributePostfixes.encrypted_content,
    label: "Encrypted",
    description:
      "The provider returned this reasoning encrypted, so it cannot be displayed.",
  },
  {
    key: MessageContentsAttributePostfixes.data,
    label: "Redacted",
    description:
      "The provider redacted this reasoning, so it cannot be displayed.",
  },
  {
    key: MessageContentsAttributePostfixes.signature,
    label: "Signature only",
    description:
      "The provider returned only a signature for this reasoning, so there is nothing to display.",
  },
] as const;

/**
 * The opaque payload a text-less reasoning part carries, or null when it
 * carries nothing at all — an instrumentation that recorded only the type.
 */
function getOpaqueReasoningKind(content: MessageContentAttributes) {
  return OPAQUE_REASONING_KINDS.find(({ key }) => content[key]) ?? null;
}

/**
 * A reasoning (thinking) part of a message, set apart from the answer the
 * model went on to give. It renders as a row flush with the message card, in
 * the same shape as the card's tool call rows: rendered inside the card's
 * disclosure group it draws no dividers of its own, and the group rules it off
 * from the answer that follows. The row opens with the summary rendered as
 * markdown, and quotes the summary's first line once closed. When the
 * provider returned only an opaque payload — OpenAI's encrypted reasoning,
 * Anthropic's redacted thinking — the row still appears so the reader can
 * tell the model reasoned, and says why there is nothing to read.
 */
export function ReasoningMessageContent({
  id: disclosureId,
  content,
}: {
  /**
   * The disclosure's id within the disclosure group it is rendered in
   */
  id?: string;
  content: MessageContentAttributes;
}) {
  const text = content[MessageContentsAttributePostfixes.text];
  const normalizedText = text
    ? formatContentAsString(text, { unquotePlainString: true })
    : undefined;
  const id = content[MessageContentsAttributePostfixes.id];
  const opaque = normalizedText ? null : getOpaqueReasoningKind(content);
  const preview = normalizedText
    ? getReasoningPreview(normalizedText)
    : opaque?.label;

  return (
    <Disclosure
      id={disclosureId}
      className="reasoning-message-content"
      css={reasoningMessageContentCSS}
    >
      <DisclosureTrigger arrowPosition="start" justifyContent="space-between">
        <Flex
          direction="row"
          gap="size-100"
          alignItems="center"
          className="reasoning-message-content__heading"
        >
          <Text className="reasoning-message-content__label">Reasoning</Text>
          {preview ? (
            <Text
              className="reasoning-message-content__preview"
              color="text-700"
              aria-hidden="true"
            >
              {preview}
            </Text>
          ) : null}
        </Flex>
        {id ? <CopyToClipboardButton text={id} /> : null}
      </DisclosureTrigger>
      <DisclosurePanel>
        <div className="reasoning-message-content__panel">
          {normalizedText ? (
            <ConnectedMarkdownBlock margin="none">
              {normalizedText}
            </ConnectedMarkdownBlock>
          ) : (
            <Text color="text-700" fontStyle="italic">
              {opaque?.description ?? "No reasoning content was recorded."}
            </Text>
          )}
          {id ? (
            <Text
              className="reasoning-message-content__id"
              size="XS"
              color="text-500"
              fontFamily="mono"
            >
              {id}
            </Text>
          ) : null}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
