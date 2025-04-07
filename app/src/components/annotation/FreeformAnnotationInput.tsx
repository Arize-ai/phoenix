import React, { useLayoutEffect, useRef } from "react";
import { Label, TextArea } from "react-aria-components";

import { Text, TextField, TextFieldProps } from "@phoenix/components";
import { useAnnotationFocus } from "@phoenix/components/annotation/AnnotationFocusContext";

import type { AnnotationConfigFreeform } from "./types";

type FreeformAnnotationInputProps = {
  annotationConfig: AnnotationConfigFreeform;
} & TextFieldProps;

export const FreeformAnnotationInput = ({
  annotationConfig,
  ...props
}: FreeformAnnotationInputProps) => {
  const { register } = useAnnotationFocus();
  const textFieldRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    register(textFieldRef);
  }, [register]);
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
