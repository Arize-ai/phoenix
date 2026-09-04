import { css } from "@emotion/react";

import { ConnectedMarkdownBlock } from "@phoenix/components/markdown";
import type { AttributeMessageContent } from "@phoenix/openInference/tracing/types";
import { formatContentAsString } from "@phoenix/utils/jsonUtils";

import { ReasoningMessageContent } from "./ReasoningMessageContent";
import { SpanImage } from "./SpanImage";
import { isReasoningMessageContent } from "./utils";

const messageContentListCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-200);
  flex-wrap: wrap;
  padding: var(--global-dimension-size-200);
`;

/**
 * Display text and reasoning content in full width. The item must not grow
 * past the list on account of an unbreakable token in its content (a reasoning
 * item id, a long URL), so its minimum width is released from its content.
 */
const messageContentTextListItemCSS = css`
  flex: 1 1 100%;
  min-width: 0;
`;

/**
 * Displays multi-modal message content. Typically an image or text, or the
 * reasoning a thinking model produced before its answer.
 * Examples:
 * {"message_content":{"text":"What is in this image?","type":"text"}}
 * {"message_content":{"type":"image","image":{"image":{"url":"https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"}}}}
 * {"message_content":{"type":"reasoning","id":"rs_123","text":"**Weighing the options**\n\n..."}}
 */
function MessageContentListItem({
  messageContentAttribute,
}: {
  messageContentAttribute: AttributeMessageContent;
}) {
  const { message_content } = messageContentAttribute;
  if (isReasoningMessageContent(messageContentAttribute)) {
    return (
      <li css={messageContentTextListItemCSS}>
        <ReasoningMessageContent content={message_content} />
      </li>
    );
  }
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

/**
 * A list of message contents. Used for multi-modal models.
 */
export function MessageContentsList({
  messageContents,
}: {
  messageContents: AttributeMessageContent[];
}) {
  return (
    <ul css={messageContentListCSS} data-testid="message-content-list">
      {messageContents.map((messageContent, idx) => {
        return (
          <MessageContentListItem
            key={idx}
            messageContentAttribute={messageContent}
          />
        );
      })}
    </ul>
  );
}
