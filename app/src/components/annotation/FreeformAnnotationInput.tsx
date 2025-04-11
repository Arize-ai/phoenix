import React, { useRef } from "react";
import { Label, TextArea } from "react-aria-components";

import { Flex, Text, TextField, TextFieldProps } from "@phoenix/components";
import { AnnotationInputExplanation } from "@phoenix/components/annotation/AnnotationInputExplanation";

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
    <Flex gap="size-50" alignItems="center">
      <TextField
        id={annotationConfig.id}
        name={annotationConfig.name}
        {...props}
        ref={textFieldRef}
        css={{
          minWidth: "100%",
        }}
      >
        <Label>{annotationConfig.name}</Label>
        <TextArea />
        <Text slot="description">{annotationConfig.description}</Text>
      </TextField>
      <AnnotationInputExplanation />
    </Flex>
  );
};
