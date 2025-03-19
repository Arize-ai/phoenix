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
  AnnotationConfigText,
} from "@phoenix/pages/settings/SettingsAnnotationsPage";

const types = [
  "categorical",
  "continuous",
  "text",
] satisfies AnnotationConfig["type"][];

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
      type: "categorical",
      values: [{ label: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "values",
  });
  const onSubmit = (data: AnnotationConfig) => {
    switch (data.type) {
      case "categorical": {
        const config: AnnotationConfigCategorical = {
          type: "categorical",
          name: data.name,
          values: data.values,
          id: initialAnnotationConfig?.id || "",
        };
        onAddAnnotationConfig(config);
        break;
      }
      case "continuous": {
        const config: AnnotationConfigContinuous = {
          type: "continuous",
          name: data.name,
          min: data.min,
          max: data.max,
          id: initialAnnotationConfig?.id || "",
        };
        onAddAnnotationConfig(config);
        break;
      }
      case "text": {
        const config: AnnotationConfigText = {
          type: "text",
          name: data.name,
          id: initialAnnotationConfig?.id || "",
        };
        onAddAnnotationConfig(config);
        break;
      }
    }
  };
  const type = watch("type");
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
            minHeight="300px"
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
                name="type"
                render={({ field }) => (
                  <RadioGroup
                    {...field}
                    aria-label="Type"
                    data-testid="type-picker"
                    direction="column"
                  >
                    <Label>Type</Label>
                    {types.map((type) => (
                      <Radio key={type} value={type}>
                        {type}
                      </Radio>
                    ))}
                  </RadioGroup>
                )}
              />
              {type === "continuous" && (
                <>
                  <Controller
                    control={control}
                    name="min"
                    rules={{
                      required: "Min is required",
                    }}
                    render={({ field, fieldState: { error } }) => (
                      <NumberField {...field} isInvalid={!!error}>
                        <Label>Min</Label>
                        <Input placeholder="0" />
                        <FieldError>{error?.message}</FieldError>
                      </NumberField>
                    )}
                  />
                  <Controller
                    control={control}
                    name="max"
                    rules={{
                      validate: (value) => {
                        if (value <= watch("min")) {
                          return "Max must be greater than min";
                        }
                        if (isNaN(value)) {
                          return "Max is required";
                        }
                        return true;
                      },
                    }}
                    render={({ field, fieldState: { error } }) => (
                      <NumberField
                        {...field}
                        isInvalid={!!error}
                        minValue={watch("min")}
                      >
                        <Label>Max</Label>
                        <Input placeholder="1" />
                        <FieldError>{error?.message}</FieldError>
                      </NumberField>
                    )}
                  />
                </>
              )}
              {type === "categorical" && (
                <>
                  {fields.map((item, index) => (
                    <Controller
                      key={item.id}
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
                            <Input placeholder={`${index}`} />
                            <Button
                              type="button"
                              onPress={() => remove(index)}
                              variant="quiet"
                              size="S"
                            >
                              <Icon svg={<Icons.TrashOutline />} />
                            </Button>
                          </Flex>
                          <FieldError>{error?.message}</FieldError>
                        </TextField>
                      )}
                    />
                  ))}
                  <Button
                    type="button"
                    onPress={() => {
                      append({ label: "" });
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
