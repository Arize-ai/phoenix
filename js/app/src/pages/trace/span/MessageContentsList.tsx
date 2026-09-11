import { css } from "@emotion/react";

import { ConnectedMarkdownBlock } from "@phoenix/components/markdown";
import type { AttributeMessageContent } from "@phoenix/openInference/tracing/types";
import { formatContentAsString } from "@phoenix/utils/jsonUtils";

import { ReasoningMessageContent } from "./ReasoningMessageContent";
import { SpanImage } from "./SpanImage";
import { isReasoningMessageContent } from "./utils";

/**
 * Text and images sit in the card's padding and wrap into a row, so several
 * images share a line.
 */
const messageContentMediaListCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-200);
  flex-wrap: wrap;
  padding: var(--global-dimension-size-200);
  margin: 0;
  list-style: none;
  box-sizing: border-box;
`;

/**
 * Display text content in full width. The item must not grow past the list on
 * account of an unbreakable token in its content (a long URL), so its minimum
 * width is released from its content.
 */
const messageContentTextListItemCSS = css`
  flex: 1 1 100%;
  min-width: 0;
`;

/**
 * Displays a text or image part of a multi-modal message.
 * Examples:
 * {"message_content":{"text":"What is in this image?","type":"text"}}
 * {"message_content":{"type":"image","image":{"image":{"url":"https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"}}}}
 */
function MessageContentListItem({
  messageContentAttribute,
}: {
  messageContentAttribute: AttributeMessageContent;
}) {
  const { message_content } = messageContentAttribute;
  const text = message_content?.text;
  const normalizedText = text
    ? formatContentAsString(text, { unquotePlainString: true })
    : undefined;
  const image = message_content?.image;
  const imageUrl = image?.image?.url;

  return (
    <li css={normalizedText ? messageContentTextListItemCSS : null}>
      {normalizedText ? (
        <ConnectedMarkdownBlock margin="none">
          {normalizedText}
        </ConnectedMarkdownBlock>
      ) : null}
      {imageUrl ? <SpanImage url={imageUrl} /> : null}
    </li>
  );
}

type MessageContentsSegment =
  | { kind: "reasoning"; content: AttributeMessageContent }
  | { kind: "media"; contents: AttributeMessageContent[] };

/**
 * The contents of a message in the order they arrived, with each run of text
 * and image parts gathered into one padded list and each reasoning part left
 * on its own. Reasoning renders as a row flush with the card, in the shape of
 * the card's tool call rows, so it cannot share a padded list with the answer.
 * Example: {"message_content":{"type":"reasoning","id":"rs_123","text":"**Weighing the options**\n\n..."}}
 */
function segmentMessageContents(
  messageContents: AttributeMessageContent[]
): MessageContentsSegment[] {
  const segments: MessageContentsSegment[] = [];
  for (const content of messageContents) {
    const messageContent = content?.message_content;
    if (isReasoningMessageContent(content)) {
      segments.push({ kind: "reasoning", content });
      continue;
    }
    // Empty text parts must not create a padded media row. Keep image parts
    // even when they have no text, and leave opaque reasoning rows above intact.
    const hasText =
      messageContent?.text != null &&
      formatContentAsString(messageContent.text, {
        unquotePlainString: true,
      }).trim().length > 0;
    const hasImage = Boolean(messageContent?.image?.image?.url);
    if (!hasText && !hasImage) {
      continue;
    }
    const last = segments[segments.length - 1];
    if (last?.kind === "media") {
      last.contents.push(content);
    } else {
      segments.push({ kind: "media", contents: [content] });
    }
  }
  return segments;
}

/**
 * The disclosure id of the reasoning row rendered for the segment at `index`.
 */
function reasoningDisclosureId(index: number): string {
  return `reasoning-${index}`;
}

/**
 * The disclosure ids of the reasoning rows `MessageContentsList` renders for
 * these contents, for the disclosure group that decides which rows start open.
 * Accepts whatever the instrumentation emitted, since the card computes this
 * outside the error boundary that guards the rendered contents.
 */
export function getReasoningDisclosureIds(messageContents: unknown): string[] {
  if (!Array.isArray(messageContents)) {
    return [];
  }
  return segmentMessageContents(messageContents).flatMap((segment, idx) =>
    segment.kind === "reasoning" ? [reasoningDisclosureId(idx)] : []
  );
}

/**
 * A list of message contents. Used for multi-modal models and for the
 * reasoning a thinking model produced before its answer.
 *
 * Renders its segments without a wrapper so they sit directly in the message
 * card's disclosure group, which owns the rules between the reasoning rows and
 * whatever follows them.
 */
export function MessageContentsList({
  messageContents,
}: {
  messageContents: AttributeMessageContent[];
}) {
  return segmentMessageContents(messageContents).map((segment, idx) =>
    segment.kind === "reasoning" ? (
      <ReasoningMessageContent
        key={idx}
        id={reasoningDisclosureId(idx)}
        content={segment.content.message_content}
      />
    ) : (
      <ul key={idx} css={messageContentMediaListCSS}>
        {segment.contents.map((content, contentIdx) => (
          <MessageContentListItem
            key={contentIdx}
            messageContentAttribute={content}
          />
        ))}
      </ul>
    )
  );
}
