import React, { useRef } from "react";

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

type ContinuousAnnotationInputProps = {
  annotationConfig: AnnotationConfigContinuous;
} & NumberFieldProps;

export const ContinuousAnnotationInput = ({
  annotationConfig,
  ...props
}: ContinuousAnnotationInputProps) => {
  const numberFieldRef = useRef<HTMLDivElement>(null);
  // step should be 1 if the min and max end in .0, .1 otherwise
  const step = (annotationConfig?.lowerBound ?? 0) % 1 === 0 ? 1 : 0.1;
  return (
    <Flex gap="size-50" alignItems="center">
      <NumberField
        {...props}
        ref={numberFieldRef}
        minValue={annotationConfig?.lowerBound ?? 0}
        maxValue={annotationConfig?.upperBound ?? 1}
        step={step}
        css={{
          minWidth: "100%",
        }}
      >
        <Label>{annotationConfig.name}</Label>
        <Input />
        <Text slot="description">
          {annotationConfig.lowerBound} - {annotationConfig.upperBound}
        </Text>
      </NumberField>
      <span style={{ marginTop: 4 }}>
        <AnnotationInputExplanation />
      </span>
    </Flex>
  );
};
