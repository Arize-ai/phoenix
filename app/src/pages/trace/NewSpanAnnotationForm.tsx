import React from "react";
import { graphql, useMutation } from "react-relay";

import { NewSpanAnnotationFormMutation } from "./__generated__/NewSpanAnnotationFormMutation.graphql";
import {
  CreateAnnotationInput,
  SpanAnnotationForm,
} from "./SpanAnnotationForm";

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
      ) {
        createSpanAnnotations(input: [$input]) {
          spanAnnotations {
            id
            name
          }
        }
      }
    `
  );
  const onSubmit = (data: CreateAnnotationInput) => {
    commit({
      variables: {
        input: {
          spanId: spanNodeId,
          annotatorKind: "HUMAN",
          ...data,
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
