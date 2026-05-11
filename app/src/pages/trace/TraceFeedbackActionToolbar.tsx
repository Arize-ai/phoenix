import { graphql, useFragment, useMutation } from "react-relay";

import {
  FeedbackActionToolbar,
  type FeedbackValue,
} from "@phoenix/components/feedback";
import {
  getUserFeedbackIdentifier,
  getUserFeedbackScore,
} from "@phoenix/constants";
import { useViewer } from "@phoenix/contexts";
import type { TraceFeedbackActionToolbar_trace$key } from "@phoenix/pages/trace/__generated__/TraceFeedbackActionToolbar_trace.graphql";
import type { TraceFeedbackActionToolbarCreateAnnotationMutation } from "@phoenix/pages/trace/__generated__/TraceFeedbackActionToolbarCreateAnnotationMutation.graphql";

function getFeedbackValue(
  label: string | null | undefined
): FeedbackValue | null {
  if (label === "positive" || label === "negative") {
    return label;
  }
  return null;
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
        viewerUserFeedbackAnnotations: traceAnnotations(
          filter: { include: { names: ["user_feedback"], sources: [APP] } }
        ) {
          id
          label
          identifier
        }
      }
    `,
    trace
  );
  const { viewer } = useViewer();
  const [createTraceAnnotation, isSubmittingFeedback] =
    useMutation<TraceFeedbackActionToolbarCreateAnnotationMutation>(graphql`
      mutation TraceFeedbackActionToolbarCreateAnnotationMutation(
        $traceId: ID!
        $label: String!
        $score: Float!
        $identifier: String!
      ) {
        createTraceAnnotations(
          input: [
            {
              traceId: $traceId
              name: "user_feedback"
              annotatorKind: HUMAN
              label: $label
              score: $score
              metadata: {}
              source: APP
              identifier: $identifier
            }
          ]
        ) {
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
  const userFeedbackIdentifier = getUserFeedbackIdentifier(viewer?.id);
  const selectedFeedback = getFeedbackValue(
    data.viewerUserFeedbackAnnotations.find(
      (annotation) => annotation.identifier === userFeedbackIdentifier
    )?.label
  );

  return (
    <FeedbackActionToolbar
      onAnnotate={onAnnotate}
      selectedFeedback={selectedFeedback}
      isSubmittingFeedback={isSubmittingFeedback}
      onFeedback={({ feedback }) => {
        if (isSubmittingFeedback || selectedFeedback === feedback) {
          return;
        }
        createTraceAnnotation({
          variables: {
            traceId: data.id,
            label: feedback,
            score: getUserFeedbackScore(feedback),
            identifier: userFeedbackIdentifier,
          },
        });
      }}
    />
  );
}
