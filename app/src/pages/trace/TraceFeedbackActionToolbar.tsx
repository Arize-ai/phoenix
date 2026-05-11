import { graphql, useFragment, useMutation } from "react-relay";

import {
  FeedbackActionToolbar,
  type FeedbackValue,
} from "@phoenix/components/feedback";
import { useViewer } from "@phoenix/contexts";
import type { TraceFeedbackActionToolbar_trace$key } from "@phoenix/pages/trace/__generated__/TraceFeedbackActionToolbar_trace.graphql";
import type { TraceFeedbackActionToolbarSetFeedbackMutation } from "@phoenix/pages/trace/__generated__/TraceFeedbackActionToolbarSetFeedbackMutation.graphql";

const USER_FEEDBACK_ANNOTATION_NAME = "user_feedback";

function getFeedbackValue(
  label: string | null | undefined
): FeedbackValue | null {
  if (label === "positive" || label === "negative") {
    return label;
  }
  return null;
}

function getSelectedFeedback({
  userFeedbackAnnotations,
  viewerId,
}: {
  userFeedbackAnnotations: ReadonlyArray<{
    readonly name: string;
    readonly label: string | null;
    readonly user: { readonly id: string } | null;
  }>;
  viewerId: string | null;
}): FeedbackValue | null {
  const currentUserFeedback = userFeedbackAnnotations.find((annotation) => {
    if (annotation.name !== USER_FEEDBACK_ANNOTATION_NAME) {
      return false;
    }
    if (viewerId == null) {
      return annotation.user == null;
    }
    return annotation.user?.id === viewerId;
  });
  return getFeedbackValue(currentUserFeedback?.label);
}

export function TraceFeedbackActionToolbar({
  trace,
  onAnnotate,
}: {
  trace: TraceFeedbackActionToolbar_trace$key;
  onAnnotate?: () => void;
}) {
  const data = useFragment<TraceFeedbackActionToolbar_trace$key>(
    graphql`
      fragment TraceFeedbackActionToolbar_trace on Trace {
        id
        userFeedbackAnnotations: traceAnnotations(
          filter: { include: { names: ["user_feedback"] } }
        ) {
          id
          name
          label
          user {
            id
          }
        }
      }
    `,
    trace
  );
  const { viewer } = useViewer();
  const [setTraceUserFeedback, isSubmittingFeedback] =
    useMutation<TraceFeedbackActionToolbarSetFeedbackMutation>(graphql`
      mutation TraceFeedbackActionToolbarSetFeedbackMutation(
        $traceId: ID!
        $label: String!
      ) {
        setTraceUserFeedback(input: { traceId: $traceId, label: $label }) {
          query {
            node(id: $traceId) {
              ... on Trace {
                ...TraceAnnotationSummaryGroup
                ...TraceFeedbackActionToolbar_trace
              }
            }
          }
        }
      }
    `);
  const selectedFeedback = getSelectedFeedback({
    userFeedbackAnnotations: data.userFeedbackAnnotations,
    viewerId: viewer?.id ?? null,
  });

  return (
    <FeedbackActionToolbar
      onAnnotate={onAnnotate}
      selectedFeedback={selectedFeedback}
      isSubmittingFeedback={isSubmittingFeedback}
      onFeedback={({ feedback }) => {
        if (isSubmittingFeedback || selectedFeedback === feedback) {
          return;
        }
        setTraceUserFeedback({
          variables: {
            traceId: data.id,
            label: feedback,
          },
        });
      }}
    />
  );
}
