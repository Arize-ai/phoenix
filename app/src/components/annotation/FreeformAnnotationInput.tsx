import React, { forwardRef } from "react";
import { Label, TextArea } from "react-aria-components";

import { Flex, Text, TextField, TextFieldProps } from "@phoenix/components";
import { AnnotationInputExplanation } from "@phoenix/components/annotation/AnnotationInputExplanation";

import type {
  AnnotationConfigFreeform,
  AnnotationInputPropsBase,
} from "./types";

type FreeformAnnotationInputProps =
  AnnotationInputPropsBase<AnnotationConfigFreeform> & TextFieldProps;

export const FreeformAnnotationInput = forwardRef<
  HTMLDivElement,
  FreeformAnnotationInputProps
>(
  (
    {
      annotationConfig,
      containerRef,
      annotation,
      onSubmitExplanation,
      ...props
    },
    ref
  ) => {
    return (
      <Flex gap="size-50" alignItems="center">
        <TextField
          id={annotationConfig.id}
          name={annotationConfig.name}
          defaultValue={annotation?.label ?? undefined}
          {...props}
          ref={ref}
          css={{
            width: "100%",
          }}
        >
          <Label>{annotationConfig.name}</Label>
          <TextArea />
          <Text slot="description">{annotationConfig.description}</Text>
        </TextField>
        <AnnotationInputExplanation
          annotation={annotation}
          onSubmit={onSubmitExplanation}
          containerRef={containerRef}
        />
      </Flex>
    );
  }
);

FreeformAnnotationInput.displayName = "FreeformAnnotationInput";
