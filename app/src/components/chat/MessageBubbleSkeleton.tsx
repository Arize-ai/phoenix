import { css } from "@emotion/react";

import { Skeleton } from "@phoenix/components";

import { messageContainerCSS, messageRowCSS } from "./styles";

const USER_PICTURE_SIZE = 24;

const skeletonPictureCSS = css`
  flex: none;
`;

export interface MessageBubbleSkeletonProps {
  /**
   * Whether the message is from the current user (outgoing) or another user (incoming)
   * @default false
   */
  isOutgoing?: boolean;
  /**
   * Height of the message bubble
   * @default 80
   */
  height?: number;
}

const skeletonRowCSS = css`
  width: 100%;
`;

const skeletonContainerCSS = css`
  width: 100%;
`;

const skeletonBubbleCSS = css`
  &[data-outgoing="true"] {
    border-radius: var(--ac-global-rounding-large)
      var(--ac-global-rounding-large) 0 var(--ac-global-rounding-large);
  }
  &[data-outgoing="false"] {
    border-radius: var(--ac-global-rounding-large)
      var(--ac-global-rounding-large) var(--ac-global-rounding-large) 0;
  }
`;
/**
 * A skeleton loading component for chat message bubbles.
 * Displays a placeholder for avatar and message content while data is loading.
 * Styled to exactly match the MessageBubble component.
 */
export function MessageBubbleSkeleton({
  isOutgoing = false,
  height = 80,
}: MessageBubbleSkeletonProps) {
  return (
    <div
      css={css(messageContainerCSS, skeletonContainerCSS)}
      data-outgoing={isOutgoing}
      data-testid="message-container"
    >
      <div css={css(messageRowCSS, skeletonRowCSS)} data-outgoing={isOutgoing}>
        <Skeleton
          width={USER_PICTURE_SIZE}
          height={USER_PICTURE_SIZE}
          borderRadius="circle"
          animation="pulse"
          css={skeletonPictureCSS}
        />
        <Skeleton
          data-outgoing={isOutgoing}
          height={height}
          animation="wave"
          data-testid="message-bubble-skeleton"
          css={skeletonBubbleCSS}
        />
      </div>
    </div>
  );
}
