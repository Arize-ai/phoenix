import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Control,
  Controller,
  useForm,
  UseFormGetValues,
  UseFormReset,
  useWatch,
} from "react-hook-form";
import { fetchQuery, graphql, useRelayEnvironment } from "react-relay";
import { zodResolver } from "@hookform/resolvers/zod";
import { JSONSchema7 } from "json-schema";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  Alert,
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
  ProgressCircle,
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
import {
  AWS_AUTH_METHOD_OPTIONS,
  type AWSAuthMethod,
  AZURE_AUTH_METHOD_OPTIONS,
  type AzureAuthMethod,
  DEFAULT_AWS_AUTH_METHOD,
  DEFAULT_AZURE_AUTH_METHOD,
  type GenerativeModelSDK,
  SDK_DEFAULT_PROVIDER,
  SDK_OPTIONS,
} from "@phoenix/constants/generativeConstants";
import { httpHeadersJSONSchema } from "@phoenix/schemas/httpHeadersSchema";

import type { CustomProviderFormTestCredentialsQuery } from "./__generated__/CustomProviderFormTestCredentialsQuery.graphql";
import { providerFormSchema } from "./customProviderFormSchema";
import {
  buildClientConfig,
  createDefaultFormData,
} from "./customProviderFormUtils";

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
 * Azure OpenAI SDK configuration.
 * Supports both API key and Azure AD token provider authentication.
 */
export interface AzureOpenAIFormData extends BaseProviderFormData {
  sdk: "AZURE_OPENAI";
  azure_endpoint: string;
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
 * Supports both explicit access keys and environment credentials (IAM role).
 */
export interface AWSBedrockFormData extends BaseProviderFormData {
  sdk: "AWS_BEDROCK";
  aws_region: string;
  aws_auth_method: AWSAuthMethod;
  // Access keys auth (when aws_auth_method === "access_keys")
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
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
  onDirtyChange?: (isDirty: boolean) => void;
}

const flexFieldCSS = css`
  flex: 1 1 auto;
`;

// Provider-specific field sections
function OpenAIFields({
  control,
  isSubmitting,
}: {
  control: Control<ProviderFormData>;
  isSubmitting: boolean;
}) {
  return (
    <ProviderSection title="OpenAI Configuration">
      <Controller
        name="openai_api_key"
        control={control}
        rules={{ required: "API Key is required" }}
        render={({ field, fieldState: { invalid, error } }) => (
          <CredentialField
            isRequired
            isInvalid={invalid}
            {...field}
            isDisabled={isSubmitting}
          >
            <Label>API Key</Label>
            <CredentialInput placeholder="sk-..." />
            {error && <FieldError>{error.message}</FieldError>}
          </CredentialField>
        )}
      />
      <Controller
        name="openai_base_url"
        control={control}
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField isInvalid={invalid} {...field} isDisabled={isSubmitting}>
            <Label>Base URL</Label>
            <Input placeholder="https://api.openai.com/v1" />
            {error ? (
              <FieldError>{error.message}</FieldError>
            ) : (
              <Text slot="description">
                Custom base URL for OpenAI-compatible endpoints
              </Text>
            )}
          </TextField>
        )}
      />
      <Flex direction="row" gap="size-100">
        <Controller
          name="openai_organization"
          control={control}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              isInvalid={invalid}
              {...field}
              isDisabled={isSubmitting}
              css={flexFieldCSS}
            >
              <Label>Organization</Label>
              <Input />
              {error && <FieldError>{error.message}</FieldError>}
            </TextField>
          )}
        />
        <Controller
          name="openai_project"
          control={control}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              isInvalid={invalid}
              {...field}
              isDisabled={isSubmitting}
              css={flexFieldCSS}
            >
              <Label>Project</Label>
              <Input />
              {error && <FieldError>{error.message}</FieldError>}
            </TextField>
          )}
        />
      </Flex>
      <Controller
        name="openai_default_headers"
        control={control}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <CodeEditorFieldWrapper
            label="Default Headers (JSON)"
            errorMessage={error?.message}
            description={
              !error?.message
                ? "Default HTTP headers sent with each request"
                : undefined
            }
          >
            <JSONEditor
              value={typeof value === "string" ? value : ""}
              onChange={onChange}
              jsonSchema={httpHeadersJSONSchema as JSONSchema7}
              placeholder='{"X-Custom-Header": "value"}'
              optionalLint
            />
          </CodeEditorFieldWrapper>
        )}
      />
    </ProviderSection>
  );
}

function AzureOpenAIFields({
  control,
  isSubmitting,
}: {
  control: Control<ProviderFormData>;
  isSubmitting: boolean;
}) {
  const authMethod =
    useWatch({ control, name: "azure_auth_method" }) || "api_key";

  return (
    <ProviderSection title="Azure OpenAI Configuration">
      <Controller
        name="azure_endpoint"
        control={control}
        rules={{ required: "Endpoint is required" }}
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField
            isRequired
            isInvalid={invalid}
            {...field}
            isDisabled={isSubmitting}
          >
            <Label>Endpoint</Label>
            <Input placeholder="https://your-resource.openai.azure.com/" />
            {error && <FieldError>{error.message}</FieldError>}
          </TextField>
        )}
      />
      <Controller
        name="azure_auth_method"
        control={control}
        rules={{ required: "Authentication Method is required" }}
        render={({ field }) => (
          <Select
            {...field}
            value={field.value ?? DEFAULT_AZURE_AUTH_METHOD}
            onChange={(key) => {
              if (key != null) {
                field.onChange(key);
              }
            }}
            isDisabled={isSubmitting}
            isRequired
          >
            <Label>Authentication Method</Label>
            <Button>
              <SelectValue />
              <SelectChevronUpDownIcon />
            </Button>
            <Popover>
              <ListBox>
                {AZURE_AUTH_METHOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} id={opt.id} textValue={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
        )}
      />
      {authMethod === "default_credentials" && (
        <Alert variant="info">
          Uses Azure DefaultAzureCredential: Managed Identity, Azure CLI, or
          environment variables (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
          AZURE_TENANT_ID).
        </Alert>
      )}
      {authMethod === "api_key" && (
        <Controller
          name="azure_api_key"
          control={control}
          rules={{ required: "API Key is required" }}
          render={({ field, fieldState: { invalid, error } }) => (
            <CredentialField
              isRequired
              isInvalid={invalid}
              {...field}
              isDisabled={isSubmitting}
            >
              <Label>API Key</Label>
              <CredentialInput />
              {error && <FieldError>{error.message}</FieldError>}
            </CredentialField>
          )}
        />
      )}
      {authMethod === "ad_token_provider" && (
        <>
          <Controller
            name="azure_tenant_id"
            control={control}
            rules={{ required: "Tenant ID is required" }}
            render={({ field, fieldState: { invalid, error } }) => (
              <TextField
                isRequired
                isInvalid={invalid}
                {...field}
                isDisabled={isSubmitting}
              >
                <Label>Tenant ID</Label>
                <Input />
                {error && <FieldError>{error.message}</FieldError>}
              </TextField>
            )}
          />
          <Controller
            name="azure_client_id"
            control={control}
            rules={{ required: "Client ID is required" }}
            render={({ field, fieldState: { invalid, error } }) => (
              <TextField
                isRequired
                isInvalid={invalid}
                {...field}
                isDisabled={isSubmitting}
              >
                <Label>Client ID</Label>
                <Input />
                {error && <FieldError>{error.message}</FieldError>}
              </TextField>
            )}
          />
          <Controller
            name="azure_client_secret"
            control={control}
            rules={{ required: "Client Secret is required" }}
            render={({ field, fieldState: { invalid, error } }) => (
              <CredentialField
                isRequired
                isInvalid={invalid}
                {...field}
                isDisabled={isSubmitting}
              >
                <Label>Client Secret</Label>
                <CredentialInput />
                {error && <FieldError>{error.message}</FieldError>}
              </CredentialField>
            )}
          />
          <Controller
            name="azure_scope"
            control={control}
            render={({ field, fieldState: { invalid, error } }) => (
              <TextField
                isInvalid={invalid}
                {...field}
                isDisabled={isSubmitting}
              >
                <Label>Scope</Label>
                <Input placeholder="https://cognitiveservices.azure.com/.default" />
                {error ? (
                  <FieldError>{error.message}</FieldError>
                ) : (
                  <Text slot="description">
                    OAuth scope for Azure AD authentication
                  </Text>
                )}
              </TextField>
            )}
          />
        </>
      )}
      <Controller
        name="azure_default_headers"
        control={control}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <CodeEditorFieldWrapper
            label="Default Headers (JSON)"
            errorMessage={error?.message}
            description={
              !error?.message
                ? "Default HTTP headers sent with each request"
                : undefined
            }
          >
            <JSONEditor
              value={typeof value === "string" ? value : ""}
              onChange={onChange}
              jsonSchema={httpHeadersJSONSchema as JSONSchema7}
              placeholder='{"X-Custom-Header": "value"}'
              optionalLint
            />
          </CodeEditorFieldWrapper>
        )}
      />
    </ProviderSection>
  );
}

function AnthropicFields({
  control,
  isSubmitting,
}: {
  control: Control<ProviderFormData>;
  isSubmitting: boolean;
}) {
  return (
    <ProviderSection title="Anthropic Configuration">
      <Controller
        name="anthropic_api_key"
        control={control}
        rules={{ required: "API Key is required" }}
        render={({ field, fieldState: { invalid, error } }) => (
          <CredentialField
            isRequired
            isInvalid={invalid}
            {...field}
            isDisabled={isSubmitting}
          >
            <Label>API Key</Label>
            <CredentialInput placeholder="sk-ant-..." />
            {error && <FieldError>{error.message}</FieldError>}
          </CredentialField>
        )}
      />
      <Controller
        name="anthropic_base_url"
        control={control}
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField isInvalid={invalid} {...field} isDisabled={isSubmitting}>
            <Label>Base URL</Label>
            <Input placeholder="https://api.anthropic.com" />
            {error && <FieldError>{error.message}</FieldError>}
          </TextField>
        )}
      />
      <Controller
        name="anthropic_default_headers"
        control={control}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <CodeEditorFieldWrapper
            label="Default Headers (JSON)"
            errorMessage={error?.message}
            description={
              !error?.message
                ? "Default HTTP headers sent with each request"
                : undefined
            }
          >
            <JSONEditor
              value={typeof value === "string" ? value : ""}
              onChange={onChange}
              jsonSchema={httpHeadersJSONSchema as JSONSchema7}
              placeholder='{"X-Custom-Header": "value"}'
              optionalLint
            />
          </CodeEditorFieldWrapper>
        )}
      />
    </ProviderSection>
  );
}

function AWSFields({
  control,
  isSubmitting,
}: {
  control: Control<ProviderFormData>;
  isSubmitting: boolean;
}) {
  const authMethod =
    useWatch({ control, name: "aws_auth_method" }) || "access_keys";

  return (
    <ProviderSection title="AWS Bedrock Configuration">
      <Controller
        name="aws_region"
        control={control}
        rules={{ required: "Region is required" }}
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField
            isRequired
            isInvalid={invalid}
            {...field}
            isDisabled={isSubmitting}
          >
            <Label>Region</Label>
            <Input placeholder="us-east-1" />
            {error && <FieldError>{error.message}</FieldError>}
          </TextField>
        )}
      />
      <Controller
        name="aws_auth_method"
        control={control}
        rules={{ required: "Authentication Method is required" }}
        render={({ field }) => (
          <Select
            {...field}
            value={field.value ?? DEFAULT_AWS_AUTH_METHOD}
            onChange={(key) => {
              if (key != null) {
                field.onChange(key);
              }
            }}
            isDisabled={isSubmitting}
            isRequired
          >
            <Label>Authentication Method</Label>
            <Button>
              <SelectValue />
              <SelectChevronUpDownIcon />
            </Button>
            <Popover>
              <ListBox>
                {AWS_AUTH_METHOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} id={opt.id} textValue={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
        )}
      />
      {authMethod === "default_credentials" && (
        <Alert variant="info">
          Uses boto3 default credential chain: IAM role, environment variables
          (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY), or ~/.aws/credentials.
        </Alert>
      )}
      {authMethod === "access_keys" && (
        <>
          <Controller
            name="aws_access_key_id"
            control={control}
            rules={{ required: "Access Key ID is required" }}
            render={({ field, fieldState: { invalid, error } }) => (
              <CredentialField
                isRequired
                isInvalid={invalid}
                {...field}
                isDisabled={isSubmitting}
              >
                <Label>Access Key ID</Label>
                <CredentialInput />
                {error && <FieldError>{error.message}</FieldError>}
              </CredentialField>
            )}
          />
          <Controller
            name="aws_secret_access_key"
            control={control}
            rules={{ required: "Secret Access Key is required" }}
            render={({ field, fieldState: { invalid, error } }) => (
              <CredentialField
                isRequired
                isInvalid={invalid}
                {...field}
                isDisabled={isSubmitting}
              >
                <Label>Secret Access Key</Label>
                <CredentialInput />
                {error && <FieldError>{error.message}</FieldError>}
              </CredentialField>
            )}
          />
          <Controller
            name="aws_session_token"
            control={control}
            render={({ field, fieldState: { invalid, error } }) => (
              <CredentialField
                isInvalid={invalid}
                {...field}
                isDisabled={isSubmitting}
              >
                <Label>Session Token</Label>
                <CredentialInput />
                {error && <FieldError>{error.message}</FieldError>}
              </CredentialField>
            )}
          />
        </>
      )}
      <Controller
        name="aws_endpoint_url"
        control={control}
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField isInvalid={invalid} {...field} isDisabled={isSubmitting}>
            <Label>Endpoint URL</Label>
            <Input placeholder="https://vpce-xxx.bedrock-runtime.us-east-1.vpce.amazonaws.com" />
            {error ? (
              <FieldError>{error.message}</FieldError>
            ) : (
              <Text slot="description">
                Custom endpoint for VPC endpoints or proxies (optional)
              </Text>
            )}
          </TextField>
        )}
      />
    </ProviderSection>
  );
}

function GoogleFields({
  control,
  isSubmitting,
}: {
  control: Control<ProviderFormData>;
  isSubmitting: boolean;
}) {
  return (
    <ProviderSection title="Google GenAI Configuration">
      <Controller
        name="google_api_key"
        control={control}
        rules={{ required: "API Key is required" }}
        render={({ field, fieldState: { invalid, error } }) => (
          <CredentialField
            isRequired
            isInvalid={invalid}
            {...field}
            isDisabled={isSubmitting}
          >
            <Label>API Key</Label>
            <CredentialInput placeholder="AIza..." />
            {error && <FieldError>{error.message}</FieldError>}
          </CredentialField>
        )}
      />
      <Controller
        name="google_base_url"
        control={control}
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField isInvalid={invalid} {...field} isDisabled={isSubmitting}>
            <Label>Base URL</Label>
            <Input />
            {error ? (
              <FieldError>{error.message}</FieldError>
            ) : (
              <Text slot="description">
                Custom base URL for the AI platform service endpoint
              </Text>
            )}
          </TextField>
        )}
      />
      <Controller
        name="google_headers"
        control={control}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <CodeEditorFieldWrapper
            label="Default Headers (JSON)"
            errorMessage={error?.message}
            description={
              !error?.message
                ? "Default HTTP headers sent with each request"
                : undefined
            }
          >
            <JSONEditor
              value={typeof value === "string" ? value : ""}
              onChange={onChange}
              jsonSchema={httpHeadersJSONSchema as JSONSchema7}
              placeholder='{"X-Custom-Header": "value"}'
              optionalLint
            />
          </CodeEditorFieldWrapper>
        )}
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
  isSubmitting,
}: {
  sdk: GenerativeModelSDK;
  control: Control<ProviderFormData>;
  isSubmitting: boolean;
}) {
  switch (sdk) {
    case "OPENAI":
      return <OpenAIFields control={control} isSubmitting={isSubmitting} />;
    case "AZURE_OPENAI":
      return (
        <AzureOpenAIFields control={control} isSubmitting={isSubmitting} />
      );
    case "ANTHROPIC":
      return <AnthropicFields control={control} isSubmitting={isSubmitting} />;
    case "AWS_BEDROCK":
      return <AWSFields control={control} isSubmitting={isSubmitting} />;
    case "GOOGLE_GENAI":
      return <GoogleFields control={control} isSubmitting={isSubmitting} />;
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
  isSubmitting,
}: {
  control: Control<ProviderFormData>;
  reset: UseFormReset<ProviderFormData>;
  getValues: UseFormGetValues<ProviderFormData>;
  isSubmitting: boolean;
}) {
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
            if (key != null) {
              const oldSDK = field.value;
              const newSDK = key as GenerativeModelSDK;
              // Note: We don't call field.onChange here because handleSDKChange
              // calls reset() which sets all form values including the SDK field.
              // Calling both would be redundant and could cause race conditions.
              handleSDKChange(oldSDK, newSDK);
            }
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

export const ProviderForm = ({
  onSubmit,
  onCancel,
  initialValues,
  isSubmitting = false,
  onDirtyChange,
}: ProviderFormProps) => {
  const defaultValues = initialValues ?? createDefaultFormData("OPENAI");

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { isDirty },
  } = useForm<ProviderFormData>({
    defaultValues,
    resolver: zodResolver(providerFormSchema),
    mode: "onBlur", // Validate on blur for better UX
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const sdk = useWatch({ control, name: "sdk" });
  // SDK is guaranteed to exist because defaultValues is always a complete ProviderFormData
  invariant(sdk, "SDK field must be defined in form state");

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Flex direction="column" gap="size-100">
        <Controller
          name="name"
          control={control}
          rules={{ required: "Name is required" }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              isRequired
              isInvalid={invalid}
              {...field}
              isDisabled={isSubmitting}
            >
              <Label>Provider Name</Label>
              <Input placeholder="My Custom Provider" />
              {error ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">
                  A unique name to identify this provider configuration
                </Text>
              )}
            </TextField>
          )}
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
          <SDKSelect
            control={control}
            reset={reset}
            getValues={getValues}
            isSubmitting={isSubmitting}
          />
          <Controller
            name="provider"
            control={control}
            rules={{ required: "Provider is required" }}
            render={({ field, fieldState: { invalid, error } }) => (
              <TextField
                isRequired
                isInvalid={invalid}
                {...field}
                isDisabled={isSubmitting}
                css={flexFieldCSS}
              >
                <Label>Provider String</Label>
                <Input placeholder="e.g., openai, azure, my-custom-provider" />
                {error && <FieldError>{error.message}</FieldError>}
              </TextField>
            )}
          />
        </Flex>

        <SDKFieldsRenderer
          sdk={sdk}
          control={control}
          isSubmitting={isSubmitting}
        />

        <TestConnectionButton
          key={sdk}
          control={control}
          getValues={getValues}
          sdk={sdk}
        />

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
  );
};

const testCredentialsQuery = graphql`
  query CustomProviderFormTestCredentialsQuery(
    $input: GenerativeModelCustomerProviderConfigInput!
  ) {
    testGenerativeModelCustomProviderCredentials(input: $input) {
      error
    }
  }
`;

type TestStatus = "idle" | "testing" | "valid" | "invalid" | "error";

/**
 * Fields required for credential testing, organized by SDK.
 * Only watch these specific fields to minimize re-renders.
 */
const CREDENTIAL_FIELDS = [
  "openai_api_key",
  "azure_endpoint",
  "azure_api_key",
  "azure_auth_method",
  "azure_tenant_id",
  "azure_client_id",
  "azure_client_secret",
  "anthropic_api_key",
  "aws_region",
  "aws_auth_method",
  "aws_access_key_id",
  "aws_secret_access_key",
  "google_api_key",
] as const;

/**
 * Check if required credential fields are filled for the selected SDK
 */
function hasRequiredCredentials(
  sdk: GenerativeModelSDK,
  credentials: Record<string, string | undefined>
): boolean {
  switch (sdk) {
    case "OPENAI":
      return Boolean(credentials.openai_api_key);
    case "AZURE_OPENAI": {
      const hasBaseConfig = credentials.azure_endpoint;
      const authMethod = credentials.azure_auth_method || "api_key";
      if (authMethod === "api_key") {
        return Boolean(hasBaseConfig && credentials.azure_api_key);
      }
      if (authMethod === "default_credentials") {
        // Environment auth only needs the endpoint
        return Boolean(hasBaseConfig);
      }
      // azure_ad_token_provider
      return Boolean(
        hasBaseConfig &&
          credentials.azure_tenant_id &&
          credentials.azure_client_id &&
          credentials.azure_client_secret
      );
    }
    case "ANTHROPIC":
      return Boolean(credentials.anthropic_api_key);
    case "AWS_BEDROCK": {
      const hasRegion = credentials.aws_region;
      const authMethod = credentials.aws_auth_method || "access_keys";
      if (authMethod === "default_credentials") {
        // Environment auth only needs the region
        return Boolean(hasRegion);
      }
      return Boolean(
        hasRegion &&
          credentials.aws_access_key_id &&
          credentials.aws_secret_access_key
      );
    }
    case "GOOGLE_GENAI":
      return Boolean(credentials.google_api_key);
    default:
      return false;
  }
}

function TestConnectionButton({
  control,
  getValues,
  sdk,
}: {
  control: Control<ProviderFormData>;
  getValues: UseFormGetValues<ProviderFormData>;
  sdk: GenerativeModelSDK;
}) {
  const environment = useRelayEnvironment();
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Watch credential fields for button enablement check
  const watchedCredentials = useWatch({
    control,
    name: CREDENTIAL_FIELDS,
  });

  // Watch all form values to reset test status when any field changes
  const watchedFormValues = useWatch({ control });

  // Build a lookup object from watched credential values
  const credentialValues = useMemo(() => {
    const result: Record<string, string | undefined> = {};
    CREDENTIAL_FIELDS.forEach((field, index) => {
      result[field] = watchedCredentials[index];
    });
    return result;
  }, [watchedCredentials]);

  // Track whether in-flight test results should be ignored
  const shouldIgnoreResultRef = useRef(false);

  // Reset test status when any form field changes
  useEffect(() => {
    shouldIgnoreResultRef.current = true; // Mark in-flight results as stale
    setTestStatus("idle");
    setErrorMessage(null);
  }, [watchedFormValues]);

  const canTest = hasRequiredCredentials(sdk, credentialValues);

  const handleTest = useCallback(async () => {
    if (!canTest) return;

    shouldIgnoreResultRef.current = false; // This test's results are valid
    setTestStatus("testing");
    setErrorMessage(null);

    try {
      const formValues = getValues();
      const clientConfig = buildClientConfig(formValues);
      const result = await fetchQuery<CustomProviderFormTestCredentialsQuery>(
        environment,
        testCredentialsQuery,
        { input: clientConfig }
      ).toPromise();

      // Ignore result if form changed during request
      if (shouldIgnoreResultRef.current) return;

      if (!result) {
        setTestStatus("error");
        setErrorMessage("No response received from server");
        return;
      }

      const error = result.testGenerativeModelCustomProviderCredentials.error;

      if (!error) {
        setTestStatus("valid");
      } else {
        setTestStatus("invalid");
        setErrorMessage(error);
      }
    } catch (err) {
      // Ignore error if form changed during request
      if (shouldIgnoreResultRef.current) return;

      setTestStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Test failed");
    }
  }, [canTest, environment, getValues]);

  const isTesting = testStatus === "testing";
  const hasResult = testStatus !== "idle" && testStatus !== "testing";

  return (
    <Flex direction="column" gap="size-100">
      <View
        borderColor="grey-200"
        borderWidth="thin"
        borderRadius="medium"
        padding="size-200"
      >
        <Flex direction="row" gap="size-200" alignItems="center">
          <Text weight="heavy">Test Credentials</Text>
          <Button
            variant="default"
            size="S"
            onPress={handleTest}
            isDisabled={isTesting || !canTest}
            css={css`
              min-width: 80px;
            `}
          >
            {isTesting ? (
              <Flex direction="row" gap="size-50" alignItems="center">
                <ProgressCircle
                  isIndeterminate
                  size="S"
                  aria-label="Testing credentials"
                />
                <span>Testing</span>
              </Flex>
            ) : (
              "Test"
            )}
          </Button>
          {!hasResult && !isTesting && (
            <Text color="text-700" size="S">
              Verify your credentials work before saving
            </Text>
          )}
        </Flex>
      </View>
      {hasResult && (
        <Alert
          variant={testStatus === "valid" ? "success" : "danger"}
          title={
            testStatus === "valid"
              ? "Credentials Valid"
              : testStatus === "invalid"
                ? "Invalid Credentials"
                : "Connection Error"
          }
          dismissable
          onDismissClick={() => {
            setTestStatus("idle");
            setErrorMessage(null);
          }}
        >
          {testStatus === "valid"
            ? "Successfully connected to the provider."
            : errorMessage}
        </Alert>
      )}
    </Flex>
  );
}
