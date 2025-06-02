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
  Text,
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
} from "./types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const optimizationDirections = [
  "MAXIMIZE",
  "MINIMIZE",
  "NONE",
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
      values: [
        { label: "", score: null },
        { label: "", score: null },
      ],
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
        width: 700px;
        max-width: 90%;
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
              maxHeight="620px"
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
                    <TextField {...field} isInvalid={!!error} autoFocus>
                      <Label>Annotation Name</Label>
                      <Input placeholder="e.g. correctness" />
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
                      isReadOnly={mode === "edit"}
                    >
                      <Label>Annotation Type</Label>
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
                      <Text slot="description">
                        Categorical - assign a category - e.g. grade, A, B, C
                        <br />
                        Continuous - assign a score within a range - e.g. 0-1,
                        0.5
                        <br />
                        Freeform - assign a freeform text comment, e.g.
                        &quot;good&quot;
                      </Text>
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
                        css={css`
                          height: 100%;
                        `}
                      >
                        <Label>Optimization Direction</Label>
                        {optimizationDirections.map((direction) => (
                          <Radio key={direction} value={direction}>
                            {direction.charAt(0).toUpperCase() +
                              direction.slice(1).toLowerCase()}
                          </Radio>
                        ))}
                        <Text marginTop="auto" slot="description">
                          Maximize - higher the score the better - e.g.,
                          correctness
                          <br />
                          Minimize - lower the score the better - e.g.,
                          hallucinations
                          <br />
                          None - higher is not better or worse
                          <br />
                        </Text>
                      </RadioGroup>
                    )}
                  />
                )}
                {annotationType === "CONTINUOUS" && (
                  <Flex
                    gap="size-800"
                    css={css`
                      // prevent input from growing when sibling inputs have errors
                      & input {
                        max-height: fit-content;
                      }
                    `}
                  >
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
                  </Flex>
                )}
                {annotationType === "CATEGORICAL" && (
                  <>
                    <Text size="XS" weight="heavy">
                      Categories
                    </Text>
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
                              autoFocus={index > 0}
                            >
                              <Input
                                placeholder={`e.g. ${ALPHABET[index % ALPHABET.length]}`}
                              />
                              <FieldError>{error?.message}</FieldError>
                            </TextField>
                          )}
                        />
                        <Controller
                          control={control}
                          name={`values.${index}.score`}
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
                                <Input
                                  placeholder={`e.g. ${index} (optional)`}
                                />
                              </Flex>
                              <FieldError>{error?.message}</FieldError>
                            </NumberField>
                          )}
                        />
                        <Button
                          type="button"
                          leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
                          aria-label="Remove category"
                          onPress={() => remove(index)}
                        />
                      </Flex>
                    ))}
                    <Flex justifyContent="end" width="100%">
                      <Button
                        type="button"
                        onPress={() => {
                          append({ label: "", score: null });
                        }}
                        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
                      >
                        Add category
                      </Button>
                    </Flex>
                  </>
                )}
              </Flex>
            </View>
            <View
              paddingX="size-200"
              paddingY="size-200"
              borderTopColor="dark"
              borderTopWidth="thin"
            >
              <Flex gap="size-100" justifyContent="end">
                <Button type="button" onPress={close}>
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
