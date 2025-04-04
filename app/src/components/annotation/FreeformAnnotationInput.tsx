import React from "react";
import { Label, TextArea } from "react-aria-components";

import { Text, TextField, TextFieldProps } from "@phoenix/components";

import type { AnnotationConfigFreeform } from "./types";

type FreeformAnnotationInputProps = {
  annotationConfig: AnnotationConfigFreeform;
} & TextFieldProps;

export const FreeformAnnotationInput = ({
  annotationConfig,
  ...props
}: FreeformAnnotationInputProps) => {
  return (
    <TextField id={annotationConfig.id} name={annotationConfig.name} {...props}>
      <Label>{annotationConfig.name}</Label>
      <TextArea />
      <Text slot="description">{annotationConfig.description}</Text>
    </TextField>
  );
};
