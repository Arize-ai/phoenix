import React, { forwardRef } from "react";

import {
  Flex,
  Input,
  Label,
  NumberField,
  NumberFieldProps,
  Text,
} from "@phoenix/components";
import { AnnotationInputExplanation } from "@phoenix/components/annotation/AnnotationInputExplanation";
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
    // step should be 1 if the min and max end in .0, .1 otherwise
    const step = (annotationConfig?.lowerBound ?? 0) % 1 === 0 ? 1 : 0.1;
    return (
      <Flex gap="size-50" alignItems="center">
        <NumberField
          defaultValue={annotation?.score ?? undefined}
          {...props}
          ref={ref}
          minValue={annotationConfig?.lowerBound ?? 0}
          maxValue={annotationConfig?.upperBound ?? 1}
          step={step}
          css={{
            width: "100%",
          }}
        >
          <Label>{annotationConfig.name}</Label>
          <Input />
          <Text slot="description">
            {annotationConfig.lowerBound} - {annotationConfig.upperBound}
          </Text>
        </NumberField>
        <span style={{ marginTop: 4 }}>
          <AnnotationInputExplanation
            annotation={annotation}
            onSubmit={onSubmitExplanation}
            containerRef={containerRef}
          />
        </span>
      </Flex>
    );
  }
);

ContinuousAnnotationInput.displayName = "ContinuousAnnotationInput";
