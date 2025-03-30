import React from "react";
import { graphql, useMutation } from "react-relay";

import { NewSpanAnnotationFormMutation } from "./__generated__/NewSpanAnnotationFormMutation.graphql";
import { AnnotationFormData, SpanAnnotationForm } from "./SpanAnnotationForm";

export type NewSpanAnnotationFormProps = {
  annotationName: string;
  spanNodeId: string;
  onCreated: () => void;
};

export function NewSpanAnnotationForm(props: NewSpanAnnotationFormProps) {
  const { annotationName: name, spanNodeId, onCreated } = props;
  const [commit, isCommitting] = useMutation<NewSpanAnnotationFormMutation>(
    graphql`
      mutation NewSpanAnnotationFormMutation(
        $input: CreateSpanAnnotationInput!
        $spanId: GlobalID!
      ) {
        createSpanAnnotations(input: [$input]) {
          query {
            node(id: $spanId) {
              ... on Span {
                ...SpanAnnotationsEditor_spanAnnotations
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
