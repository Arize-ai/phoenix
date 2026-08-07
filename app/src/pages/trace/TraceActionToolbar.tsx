import { graphql, useFragment, useMutation } from "react-relay";

import { MessageCopyAction } from "@phoenix/components/ai/message/MessageCopyAction";
import {
  FeedbackActionToolbar,
  type FeedbackValue,
} from "@phoenix/components/feedback";
import {
  getUserFeedbackIdentifier,
  getUserFeedbackScore,
} from "@phoenix/constants";
import { useViewer } from "@phoenix/contexts";
import type { TraceActionToolbar_trace$key } from "@phoenix/pages/trace/__generated__/TraceActionToolbar_trace.graphql";
import type { TraceActionToolbarCreateAnnotationMutation } from "@phoenix/pages/trace/__generated__/TraceActionToolbarCreateAnnotationMutation.graphql";
import type { TraceActionToolbarDeleteAnnotationMutation } from "@phoenix/pages/trace/__generated__/TraceActionToolbarDeleteAnnotationMutation.graphql";

function getFeedbackValue(
  label: string | null | undefined
): FeedbackValue | null {
  if (label === "positive" || label === "negative") {
    return label;
  }
  return null;
}

export function TraceActionToolbar({
  trace,
  onAnnotate,
  copyText,
}: {
  trace: TraceActionToolbar_trace$key;
  onAnnotate?: () => void;
  copyText?: string | null;
}) {
  const data = useFragment<TraceActionToolbar_trace$key>(
    graphql`
      fragment TraceActionToolbar_trace on Trace {
        id
        viewerUserFeedbackAnnotations: traceAnnotations(
          filter: { include: { names: ["user_feedback"] } }
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
  const [createTraceAnnotation, isCreatingFeedback] =
    useMutation<TraceActionToolbarCreateAnnotationMutation>(graphql`
      mutation TraceActionToolbarCreateAnnotationMutation(
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
                ...TraceActionToolbar_trace
              }
            }
          }
        }
      }
    `);
  const [deleteTraceAnnotation, isDeletingFeedback] =
    useMutation<TraceActionToolbarDeleteAnnotationMutation>(graphql`
      mutation TraceActionToolbarDeleteAnnotationMutation(
        $traceId: ID!
        $annotationId: ID!
      ) {
        deleteTraceAnnotations(input: { annotationIds: [$annotationId] }) {
          query {
            node(id: $traceId) {
              ... on Trace {
                ...TraceAnnotationSummaryGroup
                ...TraceActionToolbar_trace
              }
            }
          }
        }
      }
    `);
  const userFeedbackIdentifier = getUserFeedbackIdentifier(viewer?.id);
  const selectedFeedbackAnnotation = data.viewerUserFeedbackAnnotations.find(
    (annotation) => annotation.identifier === userFeedbackIdentifier
  );
  const selectedFeedback = getFeedbackValue(selectedFeedbackAnnotation?.label);
  const isSubmittingFeedback = isCreatingFeedback || isDeletingFeedback;

  return (
    <FeedbackActionToolbar
      onAnnotate={onAnnotate}
      selectedFeedback={selectedFeedback}
      isSubmittingFeedback={isSubmittingFeedback}
      trailingActions={
        copyText != null ? <MessageCopyAction text={copyText} /> : null
      }
      onFeedback={({ feedback }) => {
        if (isSubmittingFeedback) {
          return;
        }
        if (
          selectedFeedback === feedback &&
          selectedFeedbackAnnotation != null
        ) {
          deleteTraceAnnotation({
            variables: {
              traceId: data.id,
              annotationId: selectedFeedbackAnnotation.id,
            },
          });
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
