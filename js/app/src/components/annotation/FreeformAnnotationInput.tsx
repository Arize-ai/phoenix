import type { Ref } from "react";
import { TextArea } from "react-aria-components";

import type { TextFieldProps } from "@phoenix/components";
import { Flex, Text, TextField } from "@phoenix/components";
import { AnnotationInputLabel } from "@phoenix/components/annotation/AnnotationInputLabel";

import type {
  AnnotationConfigFreeform,
  AnnotationInputPropsBase,
} from "./types";

type FreeformAnnotationInputProps =
  AnnotationInputPropsBase<AnnotationConfigFreeform> & TextFieldProps;

export function FreeformAnnotationInput({
  ref,
  annotationConfig,
  annotation,
  ...props
}: FreeformAnnotationInputProps & { ref?: Ref<HTMLDivElement> }) {
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
}

FreeformAnnotationInput.displayName = "FreeformAnnotationInput";
