import React from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import {
  Button,
  Dialog,
  FieldError,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  NumberField,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import {
  AnnotationConfig,
  AnnotationConfigCategorical,
  AnnotationConfigContinuous,
  AnnotationConfigFreeform,
  AnnotationConfigOptimizationDirection,
  AnnotationConfigType,
} from "@phoenix/pages/settings/types";

const optimizationDirections = [
  "MAXIMIZE",
  "MINIMIZE",
] satisfies AnnotationConfigOptimizationDirection[];

const types = [
  "CATEGORICAL",
  "CONTINUOUS",
  "FREEFORM",
] satisfies AnnotationConfigType[];

export const AnnotationConfigDialog = ({
  onAddAnnotationConfig,
  initialAnnotationConfig,
}: {
  onAddAnnotationConfig: (
    config: AnnotationConfig,
    {
      onCompleted,
      onError,
    }?: { onCompleted?: () => void; onError?: (error: string) => void }
  ) => void;
  initialAnnotationConfig?: Partial<AnnotationConfig>;
}) => {
  const notifyError = useNotifyError();
  const notifySuccess = useNotifySuccess();
  const mode: "new" | "edit" = initialAnnotationConfig ? "edit" : "new";
  const { control, handleSubmit, watch } = useForm<AnnotationConfig>({
    defaultValues: initialAnnotationConfig || {
      annotationType: "CATEGORICAL",
      values: [{ label: "", score: 0 }],
      optimizationDirection: "MAXIMIZE",
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "values",
  });
  const onSubmit = (data: AnnotationConfig, close: () => void) => {
    const onCompleted = () => {
      notifySuccess({
        title:
          mode === "new"
            ? "Annotation config created!"
            : "Annotation config updated!",
      });
      close();
    };
    const onError = (error: string) => {
      notifyError({
        title:
          mode === "new"
            ? "Failed to create annotation config"
            : "Failed to update annotation config",
        message: error,
      });
    };
    switch (data.annotationType) {
      case "CATEGORICAL": {
        const config: AnnotationConfigCategorical = {
          annotationType: "CATEGORICAL",
          name: data.name,
          values: data.values,
          id: initialAnnotationConfig?.id || "",
          optimizationDirection: data.optimizationDirection,
          description: data.description,
        };
        onAddAnnotationConfig(config, { onCompleted, onError });
        break;
      }
      case "CONTINUOUS": {
        const config: AnnotationConfigContinuous = {
          annotationType: "CONTINUOUS",
          name: data.name,
          lowerBound: data.lowerBound,
          upperBound: data.upperBound,
          id: initialAnnotationConfig?.id || "",
          optimizationDirection: data.optimizationDirection,
          description: data.description,
        };
        onAddAnnotationConfig(config, { onCompleted, onError });
        break;
      }
      case "FREEFORM": {
        const config: AnnotationConfigFreeform = {
          annotationType: "FREEFORM",
          name: data.name,
          id: initialAnnotationConfig?.id || "",
          description: data.description,
        };
        onAddAnnotationConfig(config, { onCompleted, onError });
        break;
      }
    }
  };
  const annotationType = watch("annotationType");
  return (
    <Dialog
      css={css`
        border: none;
        min-width: 700px;
      `}
    >
      {({ close }) => (
        <Card
          title={
            mode === "new" ? "New Annotation Config" : "Edit Annotation Config"
          }
          variant="compact"
          bodyStyle={{ padding: 0 }}
        >
          <Form
            onSubmit={(e) => {
              handleSubmit((data) => {
                onSubmit(data, close);
              })(e);
            }}
          >
            <View
              minWidth="200px"
              padding="size-200"
              maxHeight="600px"
              overflow="auto"
            >
              <Flex
                direction="column"
                gap="size-200"
                className="new-annotation-dialog-container"
              >
                <Controller
                  name="name"
                  control={control}
                  rules={{
                    required: "Name is required",
                  }}
                  render={({ field, fieldState: { error } }) => (
                    <TextField {...field} isInvalid={!!error}>
                      <Label>Annotation Name</Label>
                      <Input placeholder="correctness" />
                      <FieldError>{error?.message}</FieldError>
                    </TextField>
                  )}
                />
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value ?? undefined}
                      css={css`
                        & .react-aria-TextArea {
                          resize: vertical;
                          transition: none;
                        }
                      `}
                    >
                      <Label>Description</Label>
                      <TextArea
                        rows={2}
                        placeholder="A description of the annotation configuration"
                      />
                    </TextField>
                  )}
                />
                <Controller
                  control={control}
                  name="annotationType"
                  render={({ field }) => (
                    <RadioGroup
                      {...field}
                      aria-label="Type"
                      data-testid="type-picker"
                      direction="column"
                      isReadOnly={mode === "edit"}
                    >
                      <Label>Type</Label>
                      {types
                        .filter((type) =>
                          mode === "edit" ? type === field.value : type
                        )
                        .map((type) => (
                          <Radio key={type} value={type}>
                            {type.charAt(0).toUpperCase() +
                              type.slice(1).toLowerCase()}
                          </Radio>
                        ))}
                    </RadioGroup>
                  )}
                />
                {(annotationType === "CONTINUOUS" ||
                  annotationType === "CATEGORICAL") && (
                  <Controller
                    control={control}
                    name="optimizationDirection"
                    render={({ field }) => (
                      <RadioGroup
                        {...field}
                        aria-label="Optimization Direction"
                        data-testid="optimization-direction-picker"
                        direction="column"
                      >
                        <Label>Optimization Direction</Label>
                        {optimizationDirections.map((direction) => (
                          <Radio key={direction} value={direction}>
                            {direction.charAt(0).toUpperCase() +
                              direction.slice(1).toLowerCase()}
                          </Radio>
                        ))}
                      </RadioGroup>
                    )}
                  />
                )}
                {annotationType === "CONTINUOUS" && (
                  <>
                    <Controller
                      control={control}
                      name="lowerBound"
                      rules={{
                        required: "Min is required",
                      }}
                      render={({
                        field: { value, ...field },
                        fieldState: { error },
                      }) => (
                        <NumberField
                          {...field}
                          value={typeof value === "number" ? value : undefined}
                          isInvalid={!!error}
                        >
                          <Label>Min</Label>
                          <Input placeholder="0" />
                          <FieldError>{error?.message}</FieldError>
                        </NumberField>
                      )}
                    />
                    <Controller
                      control={control}
                      name="upperBound"
                      rules={{
                        validate: (value) => {
                          const lowerBound = watch("lowerBound");
                          if (
                            lowerBound != null &&
                            value != null &&
                            value <= lowerBound
                          ) {
                            return "Max must be greater than min";
                          }
                          if (value != null && isNaN(value)) {
                            return "Max is required";
                          }
                          return true;
                        },
                      }}
                      render={({
                        field: { value, ...field },
                        fieldState: { error },
                      }) => {
                        const lowerBound = watch("lowerBound");
                        return (
                          <NumberField
                            {...field}
                            value={
                              typeof value === "number" ? value : undefined
                            }
                            isInvalid={!!error}
                            minValue={
                              typeof lowerBound === "number"
                                ? lowerBound
                                : undefined
                            }
                          >
                            <Label>Max</Label>
                            <Input placeholder="1" />
                            <FieldError>{error?.message}</FieldError>
                          </NumberField>
                        );
                      }}
                    />
                  </>
                )}
                {annotationType === "CATEGORICAL" && (
                  <>
                    {fields.map((item, index) => (
                      <Flex
                        key={item.id}
                        direction="row"
                        gap="size-100"
                        alignItems="start"
                      >
                        <Controller
                          control={control}
                          name={`values.${index}.label`}
                          rules={{
                            required: "Category label is required",
                          }}
                          render={({ field, fieldState: { error } }) => (
                            <TextField
                              {...field}
                              aria-label={`Value ${index + 1}`}
                              isInvalid={!!error}
                            >
                              <Input placeholder="Category label" />
                              <FieldError>{error?.message}</FieldError>
                            </TextField>
                          )}
                        />
                        <Controller
                          control={control}
                          name={`values.${index}.score`}
                          rules={{
                            required: "Score is required",
                          }}
                          render={({ field, fieldState: { error } }) => (
                            <NumberField
                              {...field}
                              value={
                                typeof field.value === "number"
                                  ? field.value
                                  : undefined
                              }
                              aria-label={`Score ${index + 1}`}
                              isInvalid={!!error}
                            >
                              <Flex
                                direction="row"
                                gap="size-100"
                                alignItems="center"
                              >
                                <Input placeholder={`${index}`} />
                              </Flex>
                              <FieldError>{error?.message}</FieldError>
                            </NumberField>
                          )}
                        />
                        <Button
                          type="button"
                          onPress={() => remove(index)}
                          variant="quiet"
                        >
                          <Icon svg={<Icons.TrashOutline />} />
                        </Button>
                      </Flex>
                    ))}
                    <Button
                      type="button"
                      onPress={() => {
                        append({ label: "", score: fields.length });
                      }}
                    >
                      Add category
                    </Button>
                  </>
                )}
              </Flex>
            </View>
            <View
              paddingX="size-200"
              paddingY="size-100"
              borderTopColor="dark"
              borderTopWidth="thin"
            >
              <Flex gap="size-100" justifyContent="end">
                <Button type="button" onPress={close} variant="quiet">
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {mode === "new"
                    ? "Create Annotation Config"
                    : "Update Annotation Config"}
                </Button>
              </Flex>
            </View>
          </Form>
        </Card>
      )}
    </Dialog>
  );
};
