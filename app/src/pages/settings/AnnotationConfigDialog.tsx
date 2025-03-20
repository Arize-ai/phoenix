/* eslint-disable no-console */
import React from "react";
import { Dialog, Input, Label } from "react-aria-components";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Icon,
  Icons,
  NumberField,
  Radio,
  RadioGroup,
  TextField,
  View,
} from "@phoenix/components";
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
  onAddAnnotationConfig: (config: AnnotationConfig) => void;
  initialAnnotationConfig?: Partial<AnnotationConfig>;
}) => {
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
  const onSubmit = (data: AnnotationConfig) => {
    switch (data.annotationType) {
      case "CATEGORICAL": {
        const config: AnnotationConfigCategorical = {
          annotationType: "CATEGORICAL",
          name: data.name,
          values: data.values,
          id: initialAnnotationConfig?.id || "",
          optimizationDirection: data.optimizationDirection,
        };
        onAddAnnotationConfig(config);
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
        };
        onAddAnnotationConfig(config);
        break;
      }
      case "FREEFORM": {
        const config: AnnotationConfigFreeform = {
          annotationType: "FREEFORM",
          name: data.name,
          id: initialAnnotationConfig?.id || "",
        };
        onAddAnnotationConfig(config);
        break;
      }
    }
  };
  const annotationType = watch("annotationType");
  return (
    <Dialog>
      {({ close }) => (
        <Form
          onSubmit={(e) => {
            handleSubmit((data) => {
              onSubmit(data);
              close();
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
                          value={typeof value === "number" ? value : undefined}
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
                      alignItems="center"
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
                            <Flex
                              direction="row"
                              gap="size-100"
                              alignItems="center"
                            >
                              <Input placeholder="Category label" />
                            </Flex>
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
                        size="S"
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
              <Button type="submit" variant="primary">
                {mode === "new" ? "Create" : "Update"}
              </Button>
            </Flex>
          </View>
        </Form>
      )}
    </Dialog>
  );
};
