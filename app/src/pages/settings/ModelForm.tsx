import { Key } from "react-aria-components";
import { Controller, useForm } from "react-hook-form";

import {
  Button,
  ComboBox,
  ComboBoxItem,
  FieldError,
  Flex,
  Form,
  Heading,
  Input,
  Label,
  NumberField,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import {
  getProviderName,
  getSemConvProvider,
} from "@phoenix/utils/generativeUtils";
import { GenerativeProviderKey } from "./__generated__/ModelsTable_models.graphql";

export type ModelFormParams = {
  name: string;
  provider?: string;
  namePattern: string;
  cost: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
    promptAudio?: number;
    completionAudio?: number;
    reasoning?: number;
  };
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
      label="Model Provider"
      placeholder="Select a provider"
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
      description="The provider that offers this model. Optional"
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
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<ModelFormParams>({
    defaultValues: {
      name: modelName ?? "",
      provider: modelProvider || "",
      namePattern: modelNamePattern ?? "",
      cost: {
        input: modelCost?.input ?? 0,
        output: modelCost?.output ?? 0,
        cacheRead: modelCost?.cacheRead ?? undefined,
        cacheWrite: modelCost?.cacheWrite ?? undefined,
        promptAudio: modelCost?.promptAudio ?? undefined,
        completionAudio: modelCost?.completionAudio ?? undefined,
      },
    },
  });

  return (
    <Form>
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
                <Label>Model Name</Label>
                <Input placeholder="e.g., gpt-4, claude-3-sonnet" />
                {error?.message ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">The name of the model</Text>
                )}
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
                <Label>Name Pattern</Label>
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
            Cost Configuration
          </Heading>
          <Flex direction="row" gap="size-200">
            <Controller
              name="cost.input"
              control={control}
              rules={{
                required: "Input token cost is required",
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <NumberField
                  isInvalid={invalid}
                  onChange={(val) => onChange(val)}
                  onBlur={onBlur}
                  value={value || 0}
                  step={0.000001}
                  minValue={0}
                  size="S"
                  formatOptions={{
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 6,
                  }}
                >
                  <Label>Input Tokens</Label>
                  <Input />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
                  ) : (
                    <Text slot="description">Cost per input token in USD</Text>
                  )}
                </NumberField>
              )}
            />

            <Controller
              name="cost.output"
              control={control}
              rules={{
                required: "Output token cost is required",
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <NumberField
                  isInvalid={invalid}
                  onChange={(val) => onChange(val)}
                  onBlur={onBlur}
                  value={value || 0}
                  step={0.000001}
                  minValue={0}
                  size="S"
                  formatOptions={{
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 6,
                  }}
                >
                  <Label>Output Tokens</Label>
                  <Input />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
                  ) : (
                    <Text slot="description">Cost per output token in USD</Text>
                  )}
                </NumberField>
              )}
            />
          </Flex>

          <Flex direction="row" gap="size-200">
            <Controller
              name="cost.cacheRead"
              control={control}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <NumberField
                  isInvalid={invalid}
                  onChange={(val) => onChange(val)}
                  onBlur={onBlur}
                  value={value || undefined}
                  step={0.000001}
                  minValue={0}
                  size="S"
                  formatOptions={{
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 6,
                  }}
                >
                  <Label>Cache Read</Label>
                  <Input />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
                  ) : (
                    <Text slot="description">
                      Cost per cached token read in USD
                    </Text>
                  )}
                </NumberField>
              )}
            />

            <Controller
              name="cost.cacheWrite"
              control={control}
              rules={{
                validate: (value) => {
                  if (value !== undefined && value < 0) {
                    return "Value must be non-negative";
                  }
                  return true;
                },
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <NumberField
                  isInvalid={invalid}
                  onChange={(val) => onChange(val)}
                  onBlur={onBlur}
                  value={value || undefined}
                  step={0.000001}
                  minValue={0}
                  size="S"
                  formatOptions={{
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 6,
                  }}
                >
                  <Label>Cache Write</Label>
                  <Input />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
                  ) : (
                    <Text slot="description">
                      Cost per cached token write in USD
                    </Text>
                  )}
                </NumberField>
              )}
            />
          </Flex>

          <Flex direction="row" gap="size-200">
            <Controller
              name="cost.promptAudio"
              control={control}
              rules={{
                validate: (value) => {
                  if (value !== undefined && value < 0) {
                    return "Value must be non-negative";
                  }
                  return true;
                },
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <NumberField
                  isInvalid={invalid}
                  onChange={(val) => onChange(val)}
                  onBlur={onBlur}
                  value={value || undefined}
                  step={0.000001}
                  minValue={0}
                  size="S"
                  formatOptions={{
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 6,
                  }}
                >
                  <Label>Prompt Audio</Label>
                  <Input />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
                  ) : (
                    <Text slot="description">
                      Cost per audio prompt token in USD
                    </Text>
                  )}
                </NumberField>
              )}
            />
            <Controller
              name="cost.completionAudio"
              control={control}
              rules={{
                validate: (value) => {
                  if (value !== undefined && value < 0) {
                    return "Value must be non-negative";
                  }
                  return true;
                },
              }}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { invalid, error },
              }) => (
                <NumberField
                  isInvalid={invalid}
                  onChange={(val) => onChange(val)}
                  onBlur={onBlur}
                  value={value || undefined}
                  step={0.000001}
                  minValue={0}
                  size="S"
                  formatOptions={{
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 6,
                  }}
                >
                  <Label>Completion Audio</Label>
                  <Input />
                  {error?.message ? (
                    <FieldError>{error.message}</FieldError>
                  ) : (
                    <Text slot="description">
                      Cost per audio completion token in USD
                    </Text>
                  )}
                </NumberField>
              )}
            />
          </Flex>
        </Flex>
      </View>

      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="light"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end">
          <Button
            isDisabled={
              (formMode === "edit" ? !isDirty : false) || isSubmitting
            }
            variant={isDirty ? "primary" : "default"}
            size="S"
            onPress={() => {
              handleSubmit(onSubmit)();
            }}
          >
            {submitButtonText}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
