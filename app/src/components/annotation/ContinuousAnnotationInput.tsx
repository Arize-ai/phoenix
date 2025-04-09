import React, { useLayoutEffect, useRef } from "react";

import {
  Input,
  Label,
  NumberField,
  NumberFieldProps,
  Text,
} from "@phoenix/components";
import { useAnnotationFocus } from "@phoenix/components/annotation/AnnotationFocusContext";
import { AnnotationConfigContinuous } from "@phoenix/pages/settings/types";

type ContinuousAnnotationInputProps = {
  annotationConfig: AnnotationConfigContinuous;
} & NumberFieldProps;

export const ContinuousAnnotationInput = ({
  annotationConfig,
  ...props
}: ContinuousAnnotationInputProps) => {
  const numberFieldRef = useRef<HTMLDivElement>(null);
  const { register } = useAnnotationFocus();
  useLayoutEffect(() => {
    register(numberFieldRef);
  }, [register]);
  // step should be 1 if the min and max end in .0, .1 otherwise
  const step = (annotationConfig?.lowerBound ?? 0) % 1 === 0 ? 1 : 0.1;
  return (
    <NumberField
      {...props}
      ref={numberFieldRef}
      minValue={annotationConfig?.lowerBound ?? 0}
      maxValue={annotationConfig?.upperBound ?? 1}
      step={step}
    >
      <Label>{annotationConfig.name}</Label>
      <Input />
      <Text slot="description">
        {annotationConfig.lowerBound} - {annotationConfig.upperBound}
      </Text>
    </NumberField>
  );
};
