import { useState } from "react";
import { Key } from "react-aria-components";
import { Controller, useFormContext } from "react-hook-form";

import { Annotation, AnnotationConfig } from "@phoenix/components/annotation";
import { CategoricalAnnotationInput } from "@phoenix/components/annotation/CategoricalAnnotationInput";
import { ContinuousAnnotationInput } from "@phoenix/components/annotation/ContinuousAnnotationInput";
import { FreeformAnnotationInput } from "@phoenix/components/annotation/FreeformAnnotationInput";

export type AnnotationFormData = {
  name: string;
  score?: number | null;
  label?: string | null;
  explanation?: string | null;
};

export type SpanAnnotationInputProps = {
  /**
   * The annotation config to that represents the type of annotation input to render
   */
  annotationConfig: AnnotationConfig;

  /**
   * The annotation to populate the form with
   */
  annotation?: Annotation;
};

/**
 * A form to create or edit a span annotation
 */
export function SpanAnnotationInput(props: SpanAnnotationInputProps) {
  const { annotationConfig, annotation } = props;
  const { control } = useFormContext<Record<string, Annotation>>();
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  return (
    <>
      <div>
        {annotationConfig.annotationType === "CATEGORICAL" && (
          <Controller
            control={control}
            name={annotationConfig.name}
            render={({ field: { value: _value, ...field } }) => (
              <CategoricalAnnotationInput
                annotationConfig={annotationConfig}
                containerRef={containerRef ?? undefined}
                annotation={annotation}
                {...field}
                selectedKey={_value?.label}
                onSubmitExplanation={(explanation) => {
                  if (annotation?.id) {
                    field.onChange({
                      ...annotation,
                      name: annotationConfig.name,
                      explanation,
                    });
                  }
                }}
                onSelectionChange={(_selectedKey) => {
                  let selectedKey: Key | null = _selectedKey;
                  if (selectedKey === _value?.label) {
                    selectedKey = null;
                  }
                  if (typeof selectedKey === "string" && selectedKey != null) {
                    const newAnnotation: Annotation = {
                      ...annotation,
                      id: annotation?.id,
                      name: annotationConfig.name,
                      label: selectedKey,
                      score:
                        annotationConfig.values?.find(
                          (value) => value.label === selectedKey
                        )?.score ?? null,
                    };
                    field.onChange(newAnnotation);
                  } else {
                    field.onChange({
                      ...annotation,
                      id: annotation?.id,
                      name: annotationConfig.name,
                      label: null,
                      score: null,
                    });
                  }
                }}
              />
            )}
          />
        )}
        {annotationConfig.annotationType === "CONTINUOUS" && (
          <Controller
            control={control}
            name={annotationConfig.name}
            render={({ field: { value: _value, ...field } }) => (
              <ContinuousAnnotationInput
                annotationConfig={annotationConfig}
                containerRef={containerRef ?? undefined}
                annotation={annotation}
                {...field}
                onSubmitExplanation={(explanation) => {
                  if (annotation?.id) {
                    field.onChange({
                      ...annotation,
                      name: annotationConfig.name,
                      explanation,
                    });
                  }
                }}
                value={_value?.score ?? undefined}
                onChange={(value) => {
                  field.onChange({
                    ...annotation,
                    id: annotation?.id,
                    name: annotationConfig.name,
                    score: value,
                  });
                }}
              />
            )}
          />
        )}
        {annotationConfig.annotationType === "FREEFORM" && (
          <Controller
            control={control}
            name={annotationConfig.name}
            render={({ field: { value: _value, ...field } }) => (
              <FreeformAnnotationInput
                annotationConfig={annotationConfig}
                annotation={annotation}
                {...field}
                value={_value?.explanation ?? ""}
                onChange={(value) => {
                  field.onChange({
                    ...annotation,
                    id: annotation?.id,
                    name: annotationConfig.name,
                    explanation: value,
                  });
                }}
              />
            )}
          />
        )}
      </div>
      <div ref={setContainerRef} />
    </>
  );
}
