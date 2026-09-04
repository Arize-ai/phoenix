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
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { ConnectedMarkdownBlock } from "@phoenix/components/markdown";
import type { AttributeMessageContent } from "@phoenix/openInference/tracing/types";
import { formatContentAsString } from "@phoenix/utils/jsonUtils";

/**
 * The attributes of a single content part, i.e. the value under the
 * `message_content` key of a message's `contents` list.
 */
type MessageContentAttributes =
  AttributeMessageContent[typeof SemanticAttributePrefixes.message_content];

const reasoningMessageContentCSS = css`
  width: 100%;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  overflow: hidden;

  /* the disclosure draws its own rule under the trigger; inside a bordered box
     that rule only earns its place while the panel below it is open */
  &:not([data-expanded]) .react-aria-Button[slot="trigger"] {
    border-bottom: none;
  }

  /* a provider item id is one unbreakable token; in a narrow drawer it has to
     give way to an ellipsis rather than push the copy button out of the box.
     Every flex row between the trigger and the title has to release the
     minimum width it would otherwise take from that token */
  .react-aria-Button[slot="trigger"] {
    width: 100%;
    box-sizing: border-box;
  }
  .react-aria-Button[slot="trigger"] > .flex {
    min-width: 0;
  }
  .reasoning-message-content__heading {
    flex: 1 1 auto;
    min-width: 0;
  }
  .reasoning-message-content__title {
    color: var(--global-text-color-700);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const reasoningMessageContentPanelCSS = css`
  padding: var(--global-dimension-size-200);
`;

/**
 * Why a reasoning part has no text to show, worded by what the provider sent
 * in its place. Returns null when the part carries nothing at all — an
 * instrumentation that recorded only the part's type.
 */
export function getOpaqueReasoningDescription(
  content: MessageContentAttributes
): string | null {
  if (content[MessageContentsAttributePostfixes.encrypted_content]) {
    return "The provider returned this reasoning encrypted, so it cannot be displayed.";
  }
  if (content[MessageContentsAttributePostfixes.data]) {
    return "The provider redacted this reasoning, so it cannot be displayed.";
  }
  if (content[MessageContentsAttributePostfixes.signature]) {
    return "The provider returned only a signature for this reasoning, so there is nothing to display.";
  }
  return null;
}

/**
 * A reasoning (thinking) part of a message, set apart from the answer the
 * model went on to give. The summary text, when the provider produced one, is
 * rendered as markdown. When the provider returned only an opaque payload —
 * OpenAI's encrypted reasoning, Anthropic's redacted thinking — the block still
 * appears so the reader can tell the model reasoned, and says why there is
 * nothing to read.
 */
export function ReasoningMessageContent({
  content,
}: {
  content: MessageContentAttributes;
}) {
  const text = content[MessageContentsAttributePostfixes.text];
  const normalizedText = text
    ? formatContentAsString(text, { unquotePlainString: true })
    : undefined;
  const id = content[MessageContentsAttributePostfixes.id];
  const opaqueDescription = normalizedText
    ? null
    : getOpaqueReasoningDescription(content);

  return (
    <Disclosure
      className="reasoning-message-content"
      css={reasoningMessageContentCSS}
      data-testid="reasoning-message-content"
    >
      <DisclosureTrigger arrowPosition="start" justifyContent="space-between">
        <Flex
          direction="row"
          gap="size-100"
          alignItems="center"
          className="reasoning-message-content__heading"
        >
          <Icon svg={<Icons.Bulb />} />
          <Text className="reasoning-message-content__title">
            Reasoning{id ? `: ${id}` : ""}
          </Text>
        </Flex>
        {id ? <CopyToClipboardButton text={id} /> : null}
      </DisclosureTrigger>
      <DisclosurePanel>
        <View css={reasoningMessageContentPanelCSS}>
          {normalizedText ? (
            <ConnectedMarkdownBlock margin="none">
              {normalizedText}
            </ConnectedMarkdownBlock>
          ) : (
            <Text color="text-700" fontStyle="italic">
              {opaqueDescription ?? "No reasoning content was recorded."}
            </Text>
          )}
        </View>
      </DisclosurePanel>
    </Disclosure>
  );
}
