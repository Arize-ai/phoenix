import React from "react";
import { graphql, useMutation } from "react-relay";

import { SpanAnnotationForm } from "./SpanAnnotationForm";

export type NewSpanAnnotationFormProps = {
  annotationName: string;
};

export function NewSpanAnnotationForm(props: NewSpanAnnotationFormProps) {
  const { annotationName: name } = props;
  const [commit, isCommitting] = useMutation<NewSpanAnnotationMutation>(graphql`
    mutation NewSpanAnnotationMutation($input: CreateSpanAnnotationInput!) {
      createSpanAnnotation(input: $input) {
        spanAnnotation {
          id
          name
        }
      }
    }
  `);
  return <SpanAnnotationForm initialData={{ name }} />;
}
