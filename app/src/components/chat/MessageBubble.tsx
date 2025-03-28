import React from "react";
import { css } from "@emotion/react";

import { UserPicture } from "@phoenix/components/user/UserPicture";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

const USER_PICTURE_SIZE = 24;

interface MessageBubbleProps {
  /** The text content of the message
   * @example "Hello, how are you?"
   */
  text: string;

  /** The timestamp when the message was sent
   * @example new Date()
   */
  timestamp: Date;

  /** Whether the message is from the current user (outgoing) or another user (incoming)
   * @default false
   */
  isOutgoing?: boolean;

  /** The name of the user who sent the message. Used for the avatar.
   * @example "John Smith"
   */
  userName: string;

  /** Optional URL to the user's profile picture. If not provided, shows initials.
   * @example "https://example.com/profile.jpg"
   * @default null
   */
  userPicture?: string | null;
}

const containerCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-50);
  max-width: 80%;
  &[data-outgoing="true"] {
    align-self: flex-end;
  }
  &[data-outgoing="false"] {
    align-self: flex-start;
  }
`;

const messageRowCSS = css`
  display: flex;
  gap: var(--ac-global-dimension-size-100);
  width: 100%;
  align-items: flex-end;
  &[data-outgoing="true"] {
    flex-direction: row-reverse;
  }
`;

const bubbleCSS = css`
  padding: var(--ac-global-dimension-size-100)
    var(--ac-global-dimension-size-150);
  font-size: var(--ac-global-font-size-s);
  line-height: var(--ac-global-line-height-s);
  word-wrap: break-word;
  &[data-outgoing="true"] {
    background-color: var(--ac-global-color-primary);
    color: var(--ac-global-color-grey-50);
    border-radius: var(--ac-global-rounding-large)
      var(--ac-global-rounding-large) 0 var(--ac-global-rounding-large);
  }
  &[data-outgoing="false"] {
    background-color: var(--ac-global-background-color-light);
    color: var(--ac-global-text-color-900);
    border-radius: var(--ac-global-rounding-large)
      var(--ac-global-rounding-large) var(--ac-global-rounding-large) 0;
  }
`;

const timestampCSS = css`
  font-size: var(--ac-global-font-size-xs);
  color: var(--ac-global-text-color-500);
  padding-left: calc(
    ${USER_PICTURE_SIZE}px + var(--ac-global-dimension-size-100)
  );
  &[data-outgoing="true"] {
    text-align: right;
    padding-left: 0;
    padding-right: calc(
      ${USER_PICTURE_SIZE}px + var(--ac-global-dimension-size-100)
    );
  }
`;

export function MessageBubble({
  text,
  timestamp,
  isOutgoing = false,
  userName,
  userPicture = null,
}: MessageBubbleProps) {
  return (
    <div css={containerCSS} data-outgoing={isOutgoing}>
      <div css={messageRowCSS} data-outgoing={isOutgoing}>
        <UserPicture
          name={userName}
          profilePictureUrl={userPicture}
          size={USER_PICTURE_SIZE}
        />
        <div css={bubbleCSS} data-outgoing={isOutgoing}>
          {text}
        </div>
      </div>
      <div css={timestampCSS} data-outgoing={isOutgoing}>
        <time dateTime={timestamp.toISOString()}>
          {fullTimeFormatter(timestamp)}
        </time>
      </div>
    </div>
  );
}
