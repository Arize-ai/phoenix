import React from "react";
import { graphql, useMutation } from "react-relay";
import { useParams } from "react-router";

import { useLastNTimeRange } from "@phoenix/components/datetime";

import { NewSpanAnnotationFormMutation } from "./__generated__/NewSpanAnnotationFormMutation.graphql";
import { AnnotationFormData, SpanAnnotationForm } from "./SpanAnnotationForm";

export type NewSpanAnnotationFormProps = {
  annotationName: string;
  spanNodeId: string;
  onCreated: () => void;
};

export function NewSpanAnnotationForm(props: NewSpanAnnotationFormProps) {
  const { annotationName: name, spanNodeId, onCreated } = props;
  const { projectId } = useParams();
  const { timeRange } = useLastNTimeRange();
  const [commit, isCommitting] = useMutation<NewSpanAnnotationFormMutation>(
    graphql`
      mutation NewSpanAnnotationFormMutation(
        $input: CreateSpanAnnotationInput!
        $spanId: GlobalID!
        $projectId: GlobalID!
        $annotationName: String!
        $timeRange: TimeRange!
      ) {
        createSpanAnnotations(input: [$input]) {
          query {
            project: node(id: $projectId) {
              ... on Project {
                ...ProjectPageHeader_stats
                ...AnnotationSummaryValueFragment
                  @arguments(
                    annotationName: $annotationName
                    timeRange: $timeRange
                  )
              }
            }
            span: node(id: $spanId) {
              ... on Span {
                ...EditSpanAnnotationsDialog_spanAnnotations
              }
            }
          }
        }
      }
    `
  );
  const onSubmit = (data: AnnotationFormData) => {
    commit({
      variables: {
        input: {
          spanId: spanNodeId,
          annotatorKind: "HUMAN",
          ...data,
        },
        spanId: spanNodeId,
        projectId: projectId as string,
        annotationName: name,
        timeRange: {
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString(),
        },
      },
      onCompleted: () => {
        onCreated();
      },
    });
  };
  return (
    <SpanAnnotationForm
      initialData={{ name }}
      isSubmitting={isCommitting}
      onSubmit={onSubmit}
    />
  );
}
