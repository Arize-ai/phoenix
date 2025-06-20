import { useMemo } from "react";
import { Key } from "react-aria-components";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Button,
  ComboBox,
  ComboBoxItem,
  FieldError,
  Flex,
  Form,
  Heading,
  Icon,
  Icons,
  Input,
  Label,
  NumberField,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import {
  DEFAULT_TOKEN_COMPLETION_OPTIONS,
  DEFAULT_TOKEN_PROMPT_OPTIONS,
  ModelTokenTypeComboBox,
} from "@phoenix/pages/settings/ModelTokenTypeComboBox";
import {
  getProviderName,
  getSemConvProvider,
} from "@phoenix/utils/generativeUtils";

/**
 * @deprecated this just exists until the resolver is updated to return an array of costs
 */
type ModelTokenCostDefinition = {
  kind: "prompt" | "completion";
  name: string;
  cost: number;
};

export type ModelFormParams = {
  name: string;
  provider?: string;
  namePattern: string;
  promptCosts: ModelTokenCostDefinition[];
  completionCosts: ModelTokenCostDefinition[];
};

/**
 * @deprecated this just exists until the resolver is updated to return an array of costs
 */
export const modelCostToModelTokenCostDefinitions = (
  costs:
    | {
        input?: number | null;
        output?: number | null;
        cacheRead?: number | null;
        cacheWrite?: number | null;
        promptAudio?: number | null;
        completionAudio?: number | null;
      }
    | null
    | undefined
): ModelTokenCostDefinition[] => {
  if (!costs) {
    return [];
  }

  const definitions: ModelTokenCostDefinition[] = [];

  if (costs.input != null) {
    definitions.push({
      name: "input",
      kind: "prompt",
      cost: costs.input,
    });
  } else {
    definitions.push({
      name: "input",
      kind: "prompt",
      cost: 0,
    });
  }
  if (costs.output != null) {
    definitions.push({
      name: "output",
      kind: "completion",
      cost: costs.output,
    });
  } else {
    definitions.push({
      name: "output",
      kind: "completion",
      cost: 0,
    });
  }
  if (costs.cacheRead != null) {
    definitions.push({
      name: "cacheRead",
      kind: "prompt",
      cost: costs.cacheRead,
    });
  }
  if (costs.cacheWrite != null) {
    definitions.push({
      name: "cacheWrite",
      kind: "prompt",
      cost: costs.cacheWrite,
    });
  }
  if (costs.promptAudio != null) {
    definitions.push({
      name: "promptAudio",
      kind: "prompt",
      cost: costs.promptAudio,
    });
  }
  if (costs.completionAudio != null) {
    definitions.push({
      name: "completionAudio",
      kind: "completion",
      cost: costs.completionAudio,
    });
  }

  return definitions;
};

const PROVIDER_OPTIONS: { key: ModelProvider; value: string; label: string }[] =
  [
    {
      key: "OPENAI",
      value: getSemConvProvider("OPENAI"),
      label: getProviderName("OPENAI"),
    },
    {
      key: "AZURE_OPENAI",
      value: getSemConvProvider("AZURE_OPENAI"),
      label: getProviderName("AZURE_OPENAI"),
    },
    {
      key: "ANTHROPIC",
      value: getSemConvProvider("ANTHROPIC"),
      label: getProviderName("ANTHROPIC"),
    },
    {
      key: "GOOGLE",
      value: getSemConvProvider("GOOGLE"),
      label: getProviderName("GOOGLE"),
    },
    {
      key: "DEEPSEEK",
      value: getSemConvProvider("DEEPSEEK"),
      label: getProviderName("DEEPSEEK"),
    },
    {
      key: "XAI",
      value: getSemConvProvider("XAI"),
      label: getProviderName("XAI"),
    },
  ];

function ModelProviderComboBox({
  value,
  onChange,
  onBlur,
  invalid,
}: {
  value: string;
  onChange: (key: Key | null) => void;
  onBlur: () => void;
  error?: string;
  invalid: boolean;
}) {
  return (
    <ComboBox
      label="Provider"
      placeholder="Choose or enter a provider"
      selectedKey={
        PROVIDER_OPTIONS.find((option) => option.value === value)?.key || ""
      }
      inputValue={value}
      onSelectionChange={(key) => {
        const provider = PROVIDER_OPTIONS.find((option) => option.key === key);
        if (provider) {
          onChange(provider.value);
        }
      }}
      onInputChange={(value) => {
        onChange(value?.toLowerCase());
      }}
      onBlur={onBlur}
      isInvalid={invalid}
      size="M"
      allowsCustomValue
    >
      {PROVIDER_OPTIONS.map((item) => (
        <ComboBoxItem key={item.key} textValue={item.key} id={item.key}>
          <Flex alignItems="center" gap="size-50">
            <GenerativeProviderIcon provider={item.key} height={18} />
            {item.label}
          </Flex>
        </ComboBoxItem>
      ))}
    </ComboBox>
  );
}

export function ModelForm({
  modelName,
  modelProvider,
  modelNamePattern,
  modelCost,
  onSubmit,
  isSubmitting,
  submitButtonText,
  formMode,
}: {
  modelName?: string | null;
  modelProvider?: string | null;
  modelNamePattern?: string | null;
  modelCost?: {
    input?: number | null;
    output?: number | null;
    cacheRead?: number | null;
    cacheWrite?: number | null;
    promptAudio?: number | null;
    completionAudio?: number | null;
  } | null;
  onSubmit: (params: ModelFormParams) => void;
  isSubmitting: boolean;
  submitButtonText: string;
  formMode: "create" | "edit";
}) {
  const defaultCost = useMemo(() => {
    return modelCostToModelTokenCostDefinitions(modelCost);
  }, [modelCost]);
  const defaultPromptCostFields = useMemo(() => {
    return defaultCost.filter((field) => field.kind === "prompt");
  }, [defaultCost]);
  const defaultCompletionCostFields = useMemo(() => {
    return defaultCost.filter((field) => field.kind === "completion");
  }, [defaultCost]);
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<ModelFormParams>({
    defaultValues: {
      name: modelName ?? "",
      provider: modelProvider || "",
      namePattern: modelNamePattern ?? "",
      promptCosts: defaultPromptCostFields,
      completionCosts: defaultCompletionCostFields,
    },
  });

  const {
    fields: promptCostFields,
    append: appendPromptCost,
    remove: removePromptCost,
  } = useFieldArray<ModelFormParams, "promptCosts">({
    control,
    name: "promptCosts",
  });

  const {
    fields: completionCostFields,
    append: appendCompletionCost,
    remove: removeCompletionCost,
  } = useFieldArray<ModelFormParams, "completionCosts">({
    control,
    name: "completionCosts",
  });

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <Controller
            name="name"
            control={control}
            rules={{
              required: "Model name is required",
              minLength: {
                value: 1,
                message: "Name must not be empty",
              },
            }}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextField
                isInvalid={invalid}
                onChange={onChange}
                onBlur={onBlur}
                value={value.toString()}
                size="S"
              >
                <Label>Model name</Label>
                <Input placeholder="e.g., gpt-4, claude-3-sonnet" />
                {error?.message && <FieldError>{error.message}</FieldError>}
              </TextField>
            )}
          />

          <Controller
            name="provider"
            control={control}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => {
              return (
                <ModelProviderComboBox
                  value={value ?? ""}
                  onChange={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                  invalid={invalid}
                />
              );
            }}
          />
          <Controller
            name="namePattern"
            control={control}
            rules={{
              required: "Name pattern is required",
            }}
            render={({
              field: { onChange, onBlur, value },
              fieldState: { invalid, error },
            }) => (
              <TextField
                isInvalid={invalid}
                onChange={onChange}
                onBlur={onBlur}
                value={value.toString()}
                size="S"
              >
                <Label>Name pattern</Label>
                <Input placeholder="e.x. ^gpt-4.*" />
                {error?.message ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">
                    Regular expression to match model names during trace
                    ingestion
                  </Text>
                )}
              </TextField>
            )}
          />

          <Heading level={3} weight="heavy">
            Prompt tokens
          </Heading>

          {promptCostFields.map((field, index) => (
            <Flex
              key={field.id}
              direction="row"
              gap="size-100"
              css={css`
                & button {
                  // ensure button only matches the height of the sibling input, and not the full space when helper text is visible
                  align-items: center;
                  height: 100%;
                }
              `}
            >
              <Controller
                name={`promptCosts.${index}.name`}
                control={control}
                render={({ fieldState: { invalid, error }, field }) => (
                  <ModelTokenTypeComboBox
                    options={DEFAULT_TOKEN_PROMPT_OPTIONS}
                    {...field}
                    invalid={invalid}
                    isRequired
                    error={error?.message}
                  />
                )}
              />
              <Controller
                name={`promptCosts.${index}.cost`}
                control={control}
                render={({ fieldState: { invalid, error }, field }) => (
                  <Flex
                    direction="column"
                    gap="size-100"
                    flexGrow={1}
                    alignItems="end"
                  >
                    <NumberField
                      isInvalid={invalid}
                      {...field}
                      step={0.000001}
                      isRequired
                      minValue={0}
                      size="S"
                      formatOptions={{
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 6,
                      }}
                    >
                      <Input />
                      {error?.message && (
                        <FieldError>{error.message}</FieldError>
                      )}
                    </NumberField>
                    {index === promptCostFields.length - 1 && (
                      <Button
                        onPress={() => {
                          appendPromptCost({
                            kind: "prompt",
                            name: "",
                            cost: 0,
                          });
                        }}
                        size="S"
                        variant="quiet"
                        css={css`
                          width: fit-content;
                        `}
                      >
                        Add row
                      </Button>
                    )}
                  </Flex>
                )}
              />
              <Button
                leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
                onPress={() => {
                  removePromptCost(index);
                }}
                size="S"
                isDisabled={promptCostFields.indexOf(field) === 0}
              />
            </Flex>
          ))}

          <Heading level={3} weight="heavy">
            Completion tokens
          </Heading>

          {completionCostFields.map((field, index) => (
            <Flex
              key={field.id}
              direction="row"
              gap="size-100"
              css={css`
                & button {
                  // ensure button only matches the height of the sibling input, and not the full space when helper text is visible
                  align-items: center;
                  height: 100%;
                }
              `}
            >
              <Controller
                name={`completionCosts.${index}.name`}
                control={control}
                render={({ fieldState: { invalid, error }, field }) => (
                  <ModelTokenTypeComboBox
                    options={DEFAULT_TOKEN_COMPLETION_OPTIONS}
                    {...field}
                    invalid={invalid}
                    isRequired
                    error={error?.message}
                  />
                )}
              />
              <Controller
                name={`completionCosts.${index}.cost`}
                control={control}
                render={({ fieldState: { invalid, error }, field }) => (
                  <Flex
                    direction="column"
                    gap="size-100"
                    flexGrow={1}
                    alignItems="end"
                  >
                    <NumberField
                      isInvalid={invalid}
                      {...field}
                      step={0.000001}
                      isRequired
                      minValue={0}
                      size="S"
                      formatOptions={{
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 6,
                      }}
                    >
                      <Input />
                      {error?.message && (
                        <FieldError>{error.message}</FieldError>
                      )}
                    </NumberField>
                    {index === completionCostFields.length - 1 && (
                      <Button
                        onPress={() => {
                          appendCompletionCost({
                            kind: "completion",
                            name: "",
                            cost: 0,
                          });
                        }}
                        size="S"
                        variant="quiet"
                        css={css`
                          width: fit-content;
                        `}
                      >
                        Add row
                      </Button>
                    )}
                  </Flex>
                )}
              />
              <Button
                leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
                onPress={() => {
                  removeCompletionCost(index);
                }}
                size="S"
                isDisabled={completionCostFields.indexOf(field) === 0}
              />
            </Flex>
          ))}
        </Flex>
      </View>

      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="light"
        borderTopWidth="thin"
        position="sticky"
        bottom={0}
        backgroundColor="dark"
      >
        <Flex direction="row" justifyContent="end">
          <Button
            isDisabled={
              (formMode === "edit" ? !isDirty : false) || isSubmitting
            }
            variant={isDirty ? "primary" : "default"}
            size="S"
            type="submit"
          >
            {submitButtonText}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
