import React from "react";
import { graphql, useMutation } from "react-relay";

import { NewSpanAnnotationFormMutation } from "./__generated__/NewSpanAnnotationFormMutation.graphql";
import { AnnotationFormData, SpanAnnotationInput } from "./SpanAnnotationForm";

export type NewSpanAnnotationFormProps = {
  annotationName: string;
  spanNodeId: string;
  onCreated: () => void;
};

// unused
// leaving open as reference for creating annotations
export function NewSpanAnnotationForm(props: NewSpanAnnotationFormProps) {
  const { annotationName: name, spanNodeId, onCreated } = props;

  return (
    <SpanAnnotationInput
      initialData={{ name }}
      isSubmitting={isCommitting}
      onSubmit={onSubmit}
    />
  );
}
