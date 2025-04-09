import React, { useRef } from "react";
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
  const textFieldRef = useRef<HTMLDivElement>(null);

  return (
    <TextField
      id={annotationConfig.id}
      name={annotationConfig.name}
      {...props}
      ref={textFieldRef}
    >
      <Label>{annotationConfig.name}</Label>
      <TextArea />
      <Text slot="description">{annotationConfig.description}</Text>
    </TextField>
  );
};
