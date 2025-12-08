import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
} from "react";
import {
  Control,
  Controller,
  FieldPath,
  useForm,
  UseFormGetValues,
  UseFormReset,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { JSONSchema7 } from "json-schema";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  Button,
  CredentialField,
  CredentialInput,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper } from "@phoenix/components/code";
import { JSONEditor } from "@phoenix/components/code/JSONEditor";
import { httpHeadersJSONSchema } from "@phoenix/schemas/httpHeadersSchema";

import type { GenerativeModelSDK } from "./__generated__/CustomProvidersCard_data.graphql";
import {
  AUTH_METHOD_OPTIONS,
  SDK_DEFAULT_PROVIDER,
  SDK_OPTIONS,
} from "./customProviderConstants";
import { providerFormSchema } from "./customProviderFormSchema";
import { createDefaultFormData } from "./customProviderFormUtils";

// =============================================================================
// Form Data Types
// =============================================================================
//
// These types represent the form state for custom provider configuration.
//
// Design Decision: Flat fields with SDK prefixes (e.g., `openai_api_key`)
// - Better integration with react-hook-form's Controller and validation
// - Simpler Zod schema construction with discriminated unions
// - Clear field naming in JSX components
// - Easy form reset when switching between SDK types
//
// The `customProviderFormUtils.ts` module handles transformation between
// this flat structure and the nested GraphQL schema structure.
// =============================================================================

/**
 * Base form data shared across all provider types.
 */
export interface BaseProviderFormData {
  /** Display name for this provider configuration */
  name: string;
  /** Optional description explaining the provider's purpose */
  description?: string;
  /** Provider identifier string (e.g., "openai", "my-custom-provider") */
  provider: string;
}

/**
 * JSON string type alias for documentation purposes.
 * Used for fields that store serialized JSON (e.g., HTTP headers).
 */
type JSONString = string;

/**
 * OpenAI SDK configuration.
 */
export interface OpenAIFormData extends BaseProviderFormData {
  sdk: "OPENAI";
  openai_api_key: string;
  openai_base_url?: string;
  openai_organization?: string;
  openai_project?: string;
  openai_default_headers?: JSONString;
}

/**
 * Azure authentication method types.
 */
export type AzureAuthMethod = "api_key" | "ad_token_provider";

/**
 * Azure OpenAI SDK configuration.
 * Supports both API key and Azure AD token provider authentication.
 */
export interface AzureOpenAIFormData extends BaseProviderFormData {
  sdk: "AZURE_OPENAI";
  azure_endpoint: string;
  azure_deployment_name: string;
  azure_api_version: string;
  azure_auth_method: AzureAuthMethod;
  // API Key auth
  azure_api_key?: string;
  // Azure AD Token Provider auth
  azure_tenant_id?: string;
  azure_client_id?: string;
  azure_client_secret?: string;
  azure_scope?: string;
  azure_default_headers?: JSONString;
}

/**
 * Anthropic SDK configuration.
 */
export interface AnthropicFormData extends BaseProviderFormData {
  sdk: "ANTHROPIC";
  anthropic_api_key: string;
  anthropic_base_url?: string;
  anthropic_default_headers?: JSONString;
}

/**
 * AWS Bedrock SDK configuration.
 * Uses AWS credentials for authentication.
 */
export interface AWSBedrockFormData extends BaseProviderFormData {
  sdk: "AWS_BEDROCK";
  aws_region: string;
  aws_access_key_id: string;
  aws_secret_access_key: string;
  aws_session_token?: string;
  aws_endpoint_url?: string;
}

/**
 * Google GenAI SDK configuration.
 */
export interface GoogleGenAIFormData extends BaseProviderFormData {
  sdk: "GOOGLE_GENAI";
  google_api_key: string;
  google_base_url?: string;
  google_headers?: JSONString;
}

/**
 * Discriminated union of all provider form data types.
 * The `sdk` field serves as the discriminator for type narrowing.
 */
export type ProviderFormData =
  | OpenAIFormData
  | AzureOpenAIFormData
  | AnthropicFormData
  | AWSBedrockFormData
  | GoogleGenAIFormData;

export interface ProviderFormProps {
  onSubmit: (data: ProviderFormData) => void;
  onCancel: () => void;
  /** Initial values for editing an existing provider. If not provided, creates a new provider with OPENAI defaults. */
  initialValues?: ProviderFormData;
  isSubmitting?: boolean;
}

// Form context to avoid prop drilling
interface FormContextValue {
  isSubmitting: boolean;
}

const FormContext = createContext<FormContextValue | null>(null);
FormContext.displayName = "FormContext";

function useFormContext(): FormContextValue {
  const context = use(FormContext);
  if (!context) {
    throw new Error("useFormContext must be used within FormContext.Provider");
  }
  return context;
}

/**
 * Type-safe field path helper for discriminated unions.
 * Allows any valid field name from the union without type errors.
 */
type ProviderFormFieldPath = FieldPath<ProviderFormData>;

// Reusable form field component - reduces Controller boilerplate
interface FormTextFieldProps {
  name: ProviderFormFieldPath;
  label: string;
  placeholder?: string;
  description?: string;
  isRequired?: boolean;
  type?: "text" | "password";
  control: Control<ProviderFormData>;
  rules?: { required?: string };
  flex?: boolean;
}

function FormTextField({
  name,
  label,
  placeholder,
  description,
  isRequired,
  type = "text",
  control,
  rules,
  flex,
}: FormTextFieldProps) {
  const { isSubmitting } = useFormContext();

  const flexCSS = flex
    ? css`
        flex: 1 1 auto;
      `
    : undefined;

  // Use CredentialField for password type to get reveal toggle
  if (type === "password") {
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field, fieldState: { invalid, error } }) => (
          <CredentialField
            isRequired={isRequired}
            isInvalid={invalid}
            {...field}
            isDisabled={isSubmitting}
            css={flexCSS}
          >
            <Label>{label}</Label>
            <CredentialInput placeholder={placeholder} />
            {error ? (
              <FieldError>{error.message}</FieldError>
            ) : (
              description && <Text slot="description">{description}</Text>
            )}
          </CredentialField>
        )}
      />
    );
  }

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { invalid, error } }) => (
        <TextField
          isRequired={isRequired}
          isInvalid={invalid}
          {...field}
          isDisabled={isSubmitting}
          type={type}
          css={flexCSS}
        >
          <Label>{label}</Label>
          <Input placeholder={placeholder} />
          {/* Show description when no error, error message when invalid */}
          {error ? (
            <FieldError>{error.message}</FieldError>
          ) : (
            description && <Text slot="description">{description}</Text>
          )}
        </TextField>
      )}
    />
  );
}

// Reusable form select component
interface FormSelectProps {
  name: ProviderFormFieldPath;
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  control: Control<ProviderFormData>;
  isRequired?: boolean;
  isDisabled?: boolean;
}

function FormSelect({
  name,
  label,
  options,
  control,
  isRequired,
  isDisabled,
}: FormSelectProps) {
  const { isSubmitting } = useFormContext();

  invariant(
    options.length > 0,
    `FormSelect "${name}" requires at least one option`
  );

  return (
    <Controller
      name={name}
      control={control}
      rules={isRequired ? { required: `${label} is required` } : undefined}
      render={({ field }) => (
        <Select
          {...field}
          value={field.value ?? options[0].id}
          onChange={(key) => field.onChange(key)}
          isDisabled={isSubmitting || isDisabled}
          isRequired={isRequired}
        >
          <Label>{label}</Label>
          <Button>
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover>
            <ListBox>
              {options.map((opt) => (
                <SelectItem key={opt.id} id={opt.id} textValue={opt.label}>
                  {opt.label}
                </SelectItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
      )}
    />
  );
}

// SDK and auth method constants are imported from customProviderConstants.ts

/**
 * HTTP Headers field with RFC 7230 validation.
 * Validates header names and values according to HTTP standards.
 */
function HeadersField({
  name,
  control,
  label = "Custom Headers (JSON)",
  placeholder,
  description = "Additional HTTP headers as JSON object",
}: {
  name: ProviderFormFieldPath;
  control: Control<ProviderFormData>;
  label?: string;
  placeholder?: string;
  description?: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange }, fieldState: { error } }) => (
        <HeadersEditor
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          label={label}
          placeholder={placeholder}
          description={description}
          fieldError={error?.message}
        />
      )}
    />
  );
}

/**
 * Internal editor component for HTTP headers.
 * Validation is handled by the Zod schema in customProviderFormSchema.ts,
 * so we only display the error from form state here (no duplicate validation).
 */
function HeadersEditor({
  value,
  onChange,
  label,
  placeholder,
  description,
  fieldError,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  description: string;
  fieldError?: string;
}) {
  return (
    <CodeEditorFieldWrapper
      label={label}
      errorMessage={fieldError}
      description={!fieldError ? description : undefined}
    >
      <JSONEditor
        value={value}
        onChange={onChange}
        jsonSchema={httpHeadersJSONSchema as JSONSchema7}
        placeholder={placeholder || '{"X-Custom-Header": "custom-value"}'}
        optionalLint
      />
    </CodeEditorFieldWrapper>
  );
}

// Provider-specific field sections
function OpenAIFields({ control }: { control: Control<ProviderFormData> }) {
  return (
    <ProviderSection title="OpenAI Configuration">
      <FormTextField
        name="openai_api_key"
        label="API Key"
        placeholder="sk-..."
        isRequired
        type="password"
        control={control}
        rules={{ required: "API Key is required" }}
      />
      <FormTextField
        name="openai_base_url"
        label="Base URL"
        placeholder="https://api.openai.com/v1"
        description="Custom base URL for OpenAI-compatible endpoints"
        control={control}
      />
      <Flex direction="row" gap="size-100">
        <FormTextField
          name="openai_organization"
          label="Organization"
          control={control}
          flex
        />
        <FormTextField
          name="openai_project"
          label="Project"
          control={control}
          flex
        />
      </Flex>
      <HeadersField
        name="openai_default_headers"
        control={control}
        label="Default Headers (JSON)"
        placeholder='{"X-Custom-Header": "value"}'
        description="Default HTTP headers sent with each request"
      />
    </ProviderSection>
  );
}

function AzureOpenAIFields({
  control,
}: {
  control: Control<ProviderFormData>;
}) {
  const authMethod =
    useWatch({ control, name: "azure_auth_method" }) || "api_key";

  return (
    <ProviderSection title="Azure OpenAI Configuration">
      <FormTextField
        name="azure_endpoint"
        label="Endpoint"
        placeholder="https://your-resource.openai.azure.com/"
        isRequired
        control={control}
        rules={{ required: "Endpoint is required" }}
      />
      <FormTextField
        name="azure_deployment_name"
        label="Deployment Name"
        isRequired
        control={control}
        rules={{ required: "Deployment Name is required" }}
      />
      <FormTextField
        name="azure_api_version"
        label="API Version"
        placeholder="e.g., 2025-06-01"
        isRequired
        control={control}
        rules={{ required: "API Version is required" }}
      />
      <FormSelect
        name="azure_auth_method"
        label="Authentication Method"
        options={AUTH_METHOD_OPTIONS}
        control={control}
        isRequired
      />
      {authMethod === "api_key" && (
        <FormTextField
          name="azure_api_key"
          label="API Key"
          isRequired
          type="password"
          control={control}
          rules={{ required: "API Key is required" }}
        />
      )}
      {authMethod === "ad_token_provider" && (
        <>
          <FormTextField
            name="azure_tenant_id"
            label="Tenant ID"
            isRequired
            control={control}
            rules={{ required: "Tenant ID is required" }}
          />
          <FormTextField
            name="azure_client_id"
            label="Client ID"
            isRequired
            control={control}
            rules={{ required: "Client ID is required" }}
          />
          <FormTextField
            name="azure_client_secret"
            label="Client Secret"
            type="password"
            isRequired
            control={control}
            rules={{ required: "Client Secret is required" }}
          />
          <FormTextField
            name="azure_scope"
            label="Scope"
            placeholder="https://cognitiveservices.azure.com/.default"
            description="OAuth scope for Azure AD authentication"
            control={control}
          />
        </>
      )}
      <HeadersField
        name="azure_default_headers"
        control={control}
        label="Default Headers (JSON)"
        placeholder='{"X-Custom-Header": "value"}'
        description="Default HTTP headers sent with each request"
      />
    </ProviderSection>
  );
}

function AnthropicFields({ control }: { control: Control<ProviderFormData> }) {
  return (
    <ProviderSection title="Anthropic Configuration">
      <FormTextField
        name="anthropic_api_key"
        label="API Key"
        placeholder="sk-ant-..."
        isRequired
        type="password"
        control={control}
        rules={{ required: "API Key is required" }}
      />
      <FormTextField
        name="anthropic_base_url"
        label="Base URL"
        placeholder="https://api.anthropic.com"
        control={control}
      />
      <HeadersField
        name="anthropic_default_headers"
        control={control}
        label="Default Headers (JSON)"
        placeholder='{"X-Custom-Header": "value"}'
        description="Default HTTP headers sent with each request"
      />
    </ProviderSection>
  );
}

function AWSFields({ control }: { control: Control<ProviderFormData> }) {
  return (
    <ProviderSection title="AWS Bedrock Configuration">
      <FormTextField
        name="aws_region"
        label="Region"
        placeholder="us-east-1"
        isRequired
        control={control}
        rules={{ required: "Region is required" }}
      />
      <FormTextField
        name="aws_access_key_id"
        label="Access Key ID"
        isRequired
        type="password"
        control={control}
        rules={{ required: "Access Key ID is required" }}
      />
      <FormTextField
        name="aws_secret_access_key"
        label="Secret Access Key"
        isRequired
        type="password"
        control={control}
        rules={{ required: "Secret Access Key is required" }}
      />
      <FormTextField
        name="aws_session_token"
        label="Session Token"
        type="password"
        control={control}
      />
      <FormTextField
        name="aws_endpoint_url"
        label="Endpoint URL"
        placeholder="https://vpce-xxx.bedrock-runtime.us-east-1.vpce.amazonaws.com"
        description="Custom endpoint for VPC endpoints or proxies (optional)"
        control={control}
      />
    </ProviderSection>
  );
}

function GoogleFields({ control }: { control: Control<ProviderFormData> }) {
  return (
    <ProviderSection title="Google GenAI Configuration">
      <FormTextField
        name="google_api_key"
        label="API Key"
        placeholder="AIza..."
        isRequired
        type="password"
        control={control}
        rules={{ required: "API Key is required" }}
      />
      <FormTextField
        name="google_base_url"
        label="Base URL"
        description="Custom base URL for the AI platform service endpoint"
        control={control}
      />
      <HeadersField
        name="google_headers"
        control={control}
        label="Default Headers (JSON)"
        placeholder='{"X-Custom-Header": "value"}'
        description="Default HTTP headers sent with each request"
      />
    </ProviderSection>
  );
}

// Wrapper for SDK-specific sections
function ProviderSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View
      borderColor="grey-200"
      borderWidth="thin"
      borderRadius="medium"
      padding="size-200"
    >
      <Flex direction="column" gap="size-100">
        <Text weight="heavy">{title}</Text>
        {children}
      </Flex>
    </View>
  );
}

// SDK-specific fields renderer
function SDKFieldsRenderer({
  sdk,
  control,
}: {
  sdk: GenerativeModelSDK;
  control: Control<ProviderFormData>;
}) {
  switch (sdk) {
    case "OPENAI":
      return <OpenAIFields control={control} />;
    case "AZURE_OPENAI":
      return <AzureOpenAIFields control={control} />;
    case "ANTHROPIC":
      return <AnthropicFields control={control} />;
    case "AWS_BEDROCK":
      return <AWSFields control={control} />;
    case "GOOGLE_GENAI":
      return <GoogleFields control={control} />;
    default: {
      // Exhaustive type check - TypeScript will error if a new SDK is added
      // without updating this switch statement
      const exhaustiveCheck: never = sdk;
      invariant(false, `Unsupported SDK type: ${exhaustiveCheck}`);
    }
  }
}

/**
 * SDK selector that resets SDK-specific fields when SDK changes.
 */
function SDKSelect({
  control,
  reset,
  getValues,
}: {
  control: Control<ProviderFormData>;
  reset: UseFormReset<ProviderFormData>;
  getValues: UseFormGetValues<ProviderFormData>;
}) {
  const { isSubmitting } = useFormContext();

  const handleSDKChange = useCallback(
    (oldSDK: GenerativeModelSDK, newSDK: GenerativeModelSDK) => {
      // Reset SDK-specific fields while preserving shared fields
      const currentValues = getValues();
      const newDefaults = createDefaultFormData(newSDK);

      // Only update provider if it matches the old SDK's default
      // (i.e., user hasn't customized it)
      const currentProviderIsDefault =
        currentValues.provider === SDK_DEFAULT_PROVIDER[oldSDK];
      const newProvider = currentProviderIsDefault
        ? SDK_DEFAULT_PROVIDER[newSDK]
        : currentValues.provider;

      reset({
        ...newDefaults,
        name: currentValues.name || "",
        description: currentValues.description || "",
        provider: newProvider,
      });
    },
    [reset, getValues]
  );

  return (
    <Controller
      name="sdk"
      control={control}
      rules={{ required: "SDK is required" }}
      render={({ field }) => (
        <Select
          value={field.value}
          onChange={(key) => {
            const oldSDK = field.value;
            const newSDK = key as GenerativeModelSDK;
            // Note: We don't call field.onChange here because handleSDKChange
            // calls reset() which sets all form values including the SDK field.
            // Calling both would be redundant and could cause race conditions.
            handleSDKChange(oldSDK, newSDK);
          }}
          isDisabled={isSubmitting}
          isRequired
        >
          <Label>SDK</Label>
          <Button>
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover>
            <ListBox>
              {SDK_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} id={opt.id} textValue={opt.label}>
                  {opt.label}
                </SelectItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
      )}
    />
  );
}

export function ProviderForm({
  onSubmit,
  onCancel,
  initialValues,
  isSubmitting = false,
}: ProviderFormProps) {
  const defaultValues = initialValues ?? createDefaultFormData("OPENAI");

  const { control, handleSubmit, reset, getValues } = useForm<ProviderFormData>(
    {
      defaultValues,
      resolver: zodResolver(providerFormSchema),
      mode: "onBlur", // Validate on blur for better UX
    }
  );

  const watchedSdk = useWatch({ control, name: "sdk" });
  // SDK is guaranteed to exist because defaultValues is always a complete ProviderFormData
  invariant(watchedSdk, "SDK field must be defined in form state");
  const sdk = watchedSdk;

  // Memoize context value to prevent unnecessary re-renders
  const formContextValue = useMemo(() => ({ isSubmitting }), [isSubmitting]);

  return (
    <FormContext value={formContextValue}>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Flex direction="column" gap="size-100">
          <FormTextField
            name="name"
            label="Provider Name"
            placeholder="My Custom Provider"
            description="A unique name to identify this provider configuration"
            isRequired
            control={control}
            rules={{ required: "Name is required" }}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField {...field} isDisabled={isSubmitting}>
                <Label>Description</Label>
                <TextArea placeholder="Optional description for this provider" />
              </TextField>
            )}
          />

          <Flex direction="row" gap="size-100" alignItems="start">
            <SDKSelect control={control} reset={reset} getValues={getValues} />
            <FormTextField
              name="provider"
              label="Provider String"
              placeholder="e.g., openai, azure, my-custom-provider"
              isRequired
              control={control}
              rules={{ required: "Provider is required" }}
              flex
            />
          </Flex>

          <SDKFieldsRenderer sdk={sdk} control={control} />

          <Flex direction="row" gap="size-100" justifyContent="end">
            <Button
              variant="default"
              onPress={onCancel}
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isDisabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : initialValues
                  ? "Update Provider"
                  : "Create Provider"}
            </Button>
          </Flex>
        </Flex>
      </Form>
    </FormContext>
  );
}
