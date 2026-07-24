import { css } from "@emotion/react";

import { ConnectedMarkdownBlock } from "@phoenix/components/markdown";
import type { AttributeMessageContent } from "@phoenix/openInference/tracing/types";
import { formatContentAsString } from "@phoenix/utils/jsonUtils";

import { SpanImage } from "./SpanImage";

const messageContentListCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-200);
  flex-wrap: wrap;
`;

/**
 * Display text content in full width.
 */
const messageContentTextListItemCSS = css`
  flex: 1 1 100%;
  padding: var(--global-dimension-size-200);
`;

/**
 * Displays multi-modal message content. Typically an image or text.
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
