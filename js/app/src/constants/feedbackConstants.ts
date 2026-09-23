export const USER_FEEDBACK_ANNOTATION_NAME = "user_feedback";
export const ANONYMOUS_USER_FEEDBACK_IDENTIFIER = "px-app:anonymous";

export type FeedbackValue = "positive" | "negative";

export function getUserFeedbackIdentifier(viewerId: string | null | undefined) {
  if (viewerId == null) {
    return ANONYMOUS_USER_FEEDBACK_IDENTIFIER;
  }
  return `px-app:${viewerId}`;
}

export function getUserFeedbackScore(feedback: FeedbackValue) {
  return feedback === "positive" ? 1 : 0;
}
