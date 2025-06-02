import { forwardRef } from "react";
import { TextArea } from "react-aria-components";

import { Flex, Text, TextField, TextFieldProps } from "@phoenix/components";
import { AnnotationInputLabel } from "@phoenix/components/annotation/AnnotationInputLabel";

import type {
  AnnotationConfigFreeform,
  AnnotationInputPropsBase,
} from "./types";

type FreeformAnnotationInputProps =
  AnnotationInputPropsBase<AnnotationConfigFreeform> & TextFieldProps;

export const FreeformAnnotationInput = forwardRef<
  HTMLDivElement,
  FreeformAnnotationInputProps
>(({ annotationConfig, annotation, ...props }, ref) => {
  return (
    <Flex gap="size-50" alignItems="center" position="relative">
      <TextField
        id={annotationConfig.id}
        name={annotationConfig.name}
        defaultValue={annotation?.explanation ?? undefined}
        {...props}
        ref={ref}
        css={{
          width: "100%",
        }}
      >
        <AnnotationInputLabel>{annotationConfig.name}</AnnotationInputLabel>
        <TextArea />
        <Text slot="description">{annotationConfig.description}</Text>
      </TextField>
    </Flex>
  );
});

FreeformAnnotationInput.displayName = "FreeformAnnotationInput";
