import React, { useLayoutEffect, useRef } from "react";

import { Slider, SliderNumberField, SliderProps } from "@phoenix/components";
import { useAnnotationFocus } from "@phoenix/components/annotation/AnnotationFocusContext";
import { AnnotationConfigContinuous } from "@phoenix/pages/settings/types";

type ContinuousAnnotationInputProps = {
  annotationConfig: AnnotationConfigContinuous;
} & SliderProps<number>;

export const ContinuousAnnotationInput = ({
  annotationConfig,
  ...props
}: ContinuousAnnotationInputProps) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const { register } = useAnnotationFocus();
  useLayoutEffect(() => {
    register(sliderRef);
  }, [register]);
  // step should be 1 if the min and max end in .0, .1 otherwise
  const step = (annotationConfig?.lowerBound ?? 0) % 1 === 0 ? 1 : 0.1;
  return (
    <Slider
      {...props}
      ref={sliderRef}
      label={annotationConfig.name}
      minValue={annotationConfig?.lowerBound ?? 0}
      maxValue={annotationConfig?.upperBound ?? 1}
      step={step}
    >
      <SliderNumberField />
    </Slider>
  );
};
