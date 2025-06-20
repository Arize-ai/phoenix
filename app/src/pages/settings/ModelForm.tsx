import { useMemo } from "react";
import { Key } from "react-aria-components";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import {
  Button,
  ComboBox,
  ComboBoxItem,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { ModelTokenCostControlTable } from "@phoenix/pages/settings/ModelTokenCostControlTable";
import {
  DEFAULT_TOKEN_COMPLETION_OPTIONS,
  DEFAULT_TOKEN_PROMPT_OPTIONS,
  ModelTokenKind,
} from "@phoenix/pages/settings/ModelTokenTypeComboBox";
import {
  getProviderName,
  getSemConvProvider,
} from "@phoenix/utils/generativeUtils";

export type TokenPrice = {
  kind: ModelTokenKind;
  tokenType: string;
  costPerMillionTokens: number;
};

export type ModelFormParams = {
  name: string;
  provider?: string;
  namePattern: string;
  promptCosts: TokenPrice[];
  completionCosts: TokenPrice[];
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
  modelCost?: TokenPrice[] | null;
  onSubmit: (params: ModelFormParams) => void;
  isSubmitting: boolean;
  submitButtonText: string;
  formMode: "create" | "edit";
}) {
  const defaultCost = useMemo(() => {
    return Array.isArray(modelCost) && modelCost.length > 0
      ? modelCost
      : ([
          {
            kind: "PROMPT",
            tokenType: "input",
            costPerMillionTokens: 0,
          },
          {
            kind: "COMPLETION",
            tokenType: "output",
            costPerMillionTokens: 0,
          },
        ] satisfies TokenPrice[]);
  }, [modelCost]);
  const defaultPromptCostFields = useMemo(() => {
    return defaultCost.filter((field) => field.kind === "PROMPT");
  }, [defaultCost]);
  const defaultCompletionCostFields = useMemo(() => {
    return defaultCost.filter((field) => field.kind === "COMPLETION");
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
                value={value}
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
                value={value}
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

          <ModelTokenCostControlTable
            title="Prompt tokens"
            namePrefix="promptCosts"
            fields={promptCostFields}
            control={control}
            tokenTypeOptions={DEFAULT_TOKEN_PROMPT_OPTIONS}
            onAppend={appendPromptCost}
            onRemove={removePromptCost}
            appendKind="PROMPT"
          />

          <ModelTokenCostControlTable
            title="Completion tokens"
            namePrefix="completionCosts"
            fields={completionCostFields}
            control={control}
            tokenTypeOptions={DEFAULT_TOKEN_COMPLETION_OPTIONS}
            onAppend={appendCompletionCost}
            onRemove={removeCompletionCost}
            appendKind="COMPLETION"
          />
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
