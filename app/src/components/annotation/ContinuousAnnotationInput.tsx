import { forwardRef } from "react";

import {
  Flex,
  Input,
  NumberField,
  NumberFieldProps,
  Text,
} from "@phoenix/components";
import { AnnotationInputExplanation } from "@phoenix/components/annotation/AnnotationInputExplanation";
import { AnnotationInputLabel } from "@phoenix/components/annotation/AnnotationInputLabel";
import { AnnotationConfigContinuous } from "@phoenix/pages/settings/types";

import { AnnotationInputPropsBase } from "./types";

type ContinuousAnnotationInputProps =
  AnnotationInputPropsBase<AnnotationConfigContinuous> & NumberFieldProps;

export const ContinuousAnnotationInput = forwardRef<
  HTMLDivElement,
  ContinuousAnnotationInputProps
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
      <Flex gap="size-50" alignItems="center" position="relative">
        <AnnotationInputExplanation
          annotation={annotation}
          onSubmit={onSubmitExplanation}
          containerRef={containerRef}
        />
        <NumberField
          defaultValue={annotation?.score ?? undefined}
          {...props}
          ref={ref}
          minValue={annotationConfig?.lowerBound ?? 0}
          maxValue={annotationConfig?.upperBound ?? 1}
          css={{
            width: "100%",
          }}
        >
          <AnnotationInputLabel>{annotationConfig.name}</AnnotationInputLabel>
          <Input
            placeholder={
              annotationConfig?.optimizationDirection === "MAXIMIZE"
                ? `e.g. ${annotationConfig.upperBound}`
                : `e.g. ${annotationConfig.lowerBound}`
            }
          />
          <Text slot="description">
            from {annotationConfig.lowerBound} to {annotationConfig.upperBound}
          </Text>
        </NumberField>
      </Flex>
    );
  }
);

ContinuousAnnotationInput.displayName = "ContinuousAnnotationInput";
