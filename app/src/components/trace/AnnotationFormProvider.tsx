import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { FormProvider, useForm } from "react-hook-form";
import { debounce } from "lodash";
import invariant from "tiny-invariant";

import { Annotation, AnnotationConfig } from "@phoenix/components/annotation";

export type AnnotationFormMutationResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

type AnnotationFormProviderProps = {
  annotation?: Annotation;
  annotationConfig: AnnotationConfig;
  currentAnnotationIDs: Set<string>;
  onCreate: (annotation: Annotation) => Promise<AnnotationFormMutationResult>;
  onUpdate: (annotation: Annotation) => Promise<AnnotationFormMutationResult>;
  onDelete: (annotation: Annotation) => Promise<AnnotationFormMutationResult>;
  onSuccess?: (annotation: Annotation) => void;
  onError?: (annotation: Annotation, error: string) => void;
};

// TODO: update this so that it only updates one annotation at a time, on blur
// - add a delete button that appears on hover beside the inputs
// - move the explanation button to a clickable link next to the input label
export const AnnotationFormProvider = ({
  annotation,
  annotationConfig,
  currentAnnotationIDs,
  onCreate,
  onUpdate,
  onDelete,
  children,
  onSuccess,
  onError,
}: PropsWithChildren<AnnotationFormProviderProps>) => {
  const annotationConfigName = annotationConfig.name;
  invariant(annotationConfigName, "annotation config must have a name");
  const defaultValue = useMemo(() => {
    return (
      annotation || {
        name: annotationConfigName,
        label: null,
        score: null,
        explanation: null,
      }
    );
  }, [annotation, annotationConfigName]);

  const form = useForm<Record<string, Annotation>>({
    defaultValues: {
      [annotationConfigName]: defaultValue,
    },
  });

  const submit = useCallback(
    async (payload: Record<string, Annotation>) => {
      const data = { ...payload[annotationConfigName], id: annotation?.id };
      if (!data) return;
      let action: "create" | "update" | "delete" | undefined;
      if (
        (data.id && data.score == null && !data.label) ||
        (data.id && isNaN(data.score as number) && !data.label)
      ) {
        action = "delete";
      } else if (data.id && currentAnnotationIDs.has(data.id)) {
        action = "update";
      } else {
        action = "create";
      }

      let result: AnnotationFormMutationResult;
      switch (action) {
        case "create": {
          result = await onCreate(data);
          break;
        }
        case "update": {
          result = await onUpdate(data);
          break;
        }
        case "delete": {
          result = await onDelete(data);
          break;
        }
      }

      if (result.success) {
        onSuccess?.(data);
      } else {
        form.setError("root", { message: result.error });
        onError?.(data, result.error);
      }
    },
    [
      annotation,
      annotationConfigName,
      currentAnnotationIDs,
      form,
      onCreate,
      onDelete,
      onError,
      onSuccess,
      onUpdate,
    ]
  );

  // create a debounced submit handler
  const handleSubmit = form.handleSubmit;
  const debouncedSubmit = useMemo(
    () => debounce(handleSubmit(submit), 500),
    [handleSubmit, submit]
  );
  const debouncedSubmitRef = useRef(debouncedSubmit);
  useEffect(() => {
    debouncedSubmitRef.current = debouncedSubmit;
  }, [debouncedSubmit]);
  // watch the form for changes and call the debounced submit handler
  const watch = form.watch;
  useEffect(() => {
    const { unsubscribe } = watch((value) => {
      if (value) {
        debouncedSubmitRef.current();
      }
    });
    return () => unsubscribe();
  }, [watch]);

  return <FormProvider {...form}>{children}</FormProvider>;
};
