import type { ReactNode } from "react";

import { MessageAction } from "@phoenix/components/ai/message/MessageAction";
import { MessageActions } from "@phoenix/components/ai/message/MessageActions";
import { Icon, Icons } from "@phoenix/components/core/icon";

export type FeedbackValue = "positive" | "negative";

export function FeedbackActionToolbar({
  annotationAction,
  selectedFeedback,
  isSubmittingFeedback = false,
  onFeedback,
}: {
  annotationAction?: ReactNode;
  selectedFeedback: FeedbackValue | null;
  isSubmittingFeedback?: boolean;
  onFeedback: ({ feedback }: { feedback: FeedbackValue }) => void;
}) {
  const isPositiveSelected = selectedFeedback === "positive";
  const isNegativeSelected = selectedFeedback === "negative";

  return (
    <MessageActions aria-label="Feedback actions">
      {annotationAction}
      <MessageAction
        label="Thumbs up"
        tooltip={
          isPositiveSelected
            ? "Remove positive feedback"
            : "Set feedback to positive"
        }
        isDisabled={isSubmittingFeedback}
        onPress={() => {
          onFeedback({ feedback: "positive" });
        }}
      >
        <Icon
          svg={<Icons.ThumbsUp />}
          color={isPositiveSelected ? "success" : "inherit"}
        />
      </MessageAction>
      <MessageAction
        label="Thumbs down"
        tooltip={
          isNegativeSelected
            ? "Remove negative feedback"
            : "Set feedback to negative"
        }
        isDisabled={isSubmittingFeedback}
        onPress={() => {
          onFeedback({ feedback: "negative" });
        }}
      >
        <Icon
          svg={<Icons.ThumbsDown />}
          color={isNegativeSelected ? "danger" : "inherit"}
        />
      </MessageAction>
    </MessageActions>
  );
}
