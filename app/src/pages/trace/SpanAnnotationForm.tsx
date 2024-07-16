import React, { useCallback, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import { Button, Flex, TextArea, TextField, View } from "@arizeai/components";
interface AnnotationInterface {
  name: string;
  score?: number | string | null;
  label?: string | null;
  explanation?: string | null;
}

type SpanAnnotationFormProps = {
  /**
   * The initial data to populate the form with
   */
  initialData: AnnotationInterface;
  /**
   * Whether the form is read only
   */
  isReadOnly?: boolean;
  /**
   * Callback to call when the form is submitted
   */
  onSubmit?: (data: AnnotationInterface) => void;
};
/**
 * A form to create or edit a span annotation
 */
export function SpanAnnotationForm(props: SpanAnnotationFormProps) {
  const { initialData, isReadOnly, onSubmit } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
    setError,
  } = useForm({
    defaultValues: initialData,
    disabled: isReadOnly,
  });

  // Internal onSubmit that performs validation
  const _onSubmit = useCallback(
    (data: AnnotationInterface) => {
      if (!data.label && data.score === "") {
        setError("label", {
          type: "manual",
          message: "Label or score is required",
        });
        setError("score", {
          type: "manual",
          message: "Label or score is required",
        });
        return;
      }
      onSubmit && onSubmit(data);
    },
    [onSubmit, setError]
  );

  return (
    <form onSubmit={handleSubmit(_onSubmit)} ref={formRef}>
      <View padding="size-200">
        <Flex direction="column" gap="size-100">
          <div
            css={css`
              display: flex;
              flex-direction: row;
              gap: var(--ac-global-dimension-size-100);
              & > * {
                flex: 1 1 auto;
              }
            `}
          >
            <Controller
              name="label"
              control={control}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <TextField
                  label="Label"
                  placeholder="e.x. good, bad"
                  description="A categorical label like 'good' or 'bad'"
                  isReadOnly={isReadOnly}
                  errorMessage={error?.message}
                  validationState={invalid ? "invalid" : "valid"}
                  onChange={onChange}
                  onBlur={onBlur}
                  value={value?.toString() || ""}
                />
              )}
            />
            <Controller
              name="score"
              control={control}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <TextField
                  label="Score"
                  placeholder="e.x. 0.8"
                  description="A numeric grade"
                  errorMessage={error?.message}
                  isReadOnly={isReadOnly}
                  validationState={invalid ? "invalid" : "valid"}
                  onChange={onChange}
                  onBlur={onBlur}
                  value={value?.toString() || ""}
                />
              )}
            />
          </div>
          <Controller
            name="explanation"
            control={control}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextArea
                label="Explanation"
                height={100}
                isReadOnly={isReadOnly}
                description="Why this score or label was given"
                errorMessage={error?.message}
                validationState={invalid ? "invalid" : "valid"}
                onChange={onChange}
                onBlur={onBlur}
                value={value?.toString() || ""}
              />
            )}
          />
        </Flex>
      </View>
      <>
        {!isReadOnly ? (
          <View padding="size-200" borderTopWidth="thin" borderColor="dark">
            <Flex direction="row" justifyContent="end">
              <Button
                variant="primary"
                type="submit"
                isDisabled={!isValid || !isDirty}
                onClick={() => {
                  // TODO: This is a bit of a hack as the form is not working in a dialog for some reason
                  // It probably has to do with the nested DOM structure under which it is being mounted
                  formRef.current?.requestSubmit();
                }}
              >
                Save
              </Button>
            </Flex>
          </View>
        ) : null}
      </>
    </form>
  );
}
