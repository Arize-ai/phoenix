import { MessageAction, MessageActions } from "@phoenix/components/ai/message";
import { Icon, Icons } from "@phoenix/components/core/icon";

export type FeedbackValue = "positive" | "negative";

export function FeedbackActionToolbar({
  onAnnotate,
  selectedFeedback,
  isSubmittingFeedback = false,
  onFeedback,
}: {
  onAnnotate?: () => void;
  selectedFeedback: FeedbackValue | null;
  isSubmittingFeedback?: boolean;
  onFeedback: ({ feedback }: { feedback: FeedbackValue }) => void;
}) {
  const isPositiveSelected = selectedFeedback === "positive";
  const isNegativeSelected = selectedFeedback === "negative";

  return (
    <MessageActions aria-label="Feedback actions">
      {onAnnotate ? (
        <MessageAction
          label="Annotate"
          tooltip="Annotate"
          onPress={() => {
            onAnnotate();
          }}
        >
          <Icon svg={<Icons.EditOutline />} />
        </MessageAction>
      ) : null}
      <MessageAction
        label="Thumbs up"
        tooltip="Set feedback to positive"
        isDisabled={isSubmittingFeedback}
        onPress={() => {
          onFeedback({ feedback: "positive" });
        }}
      >
        <Icon
          svg={<Icons.ThumbsUpOutline />}
          color={isPositiveSelected ? "success" : "inherit"}
        />
      </MessageAction>
      <MessageAction
        label="Thumbs down"
        tooltip="Set feedback to negative"
        isDisabled={isSubmittingFeedback}
        onPress={() => {
          onFeedback({ feedback: "negative" });
        }}
      >
        <Icon
          svg={<Icons.ThumbsDownOutline />}
          color={isNegativeSelected ? "danger" : "inherit"}
        />
      </MessageAction>
    </MessageActions>
  );
}
