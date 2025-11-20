import React from "react";
import {
  type Control,
  Controller,
  useForm,
  type UseFormWatch,
} from "react-hook-form";
import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Icon,
  Icons,
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
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";

import type { GenerativeModelCustomProviderSDK } from "./__generated__/CustomProvidersCard_data.graphql";
import { HeadersField } from "./CustomProviderFormComponents";
import {
  createDefaultFormData,
  modelProviderToProviderString,
  modelProviderToSDK,
} from "./customProviderFormUtils";
import { StringValueOrLookupField } from "./StringValueOrLookupField";

// Base form data shared across all provider types
export interface BaseProviderFormData {
  name: string;
  description?: string;
  provider: string; // Free-form provider string (e.g., "openai", "custom-provider")
}

// OpenAI specific form data
export interface OpenAIFormData extends BaseProviderFormData {
  sdk: "OPENAI";
  // Basic settings
  openai_api_key: string;
  openai_api_key_is_env_var?: boolean;
  openai_base_url?: string;
  openai_base_url_is_env_var?: boolean;
  openai_organization?: string;
  openai_organization_is_env_var?: boolean;
  openai_project?: string;
  openai_project_is_env_var?: boolean;
  // Advanced settings
  openai_default_headers?: string; // JSON as string
}

// Azure OpenAI specific form data
export interface AzureOpenAIFormData extends BaseProviderFormData {
  sdk: "AZURE_OPENAI";
  // Basic settings
  azure_endpoint: string;
  azure_endpoint_is_env_var?: boolean;
  azure_deployment_name: string;
  azure_deployment_name_is_env_var?: boolean;
  azure_api_version: string;
  azure_api_version_is_env_var?: boolean;
  azure_auth_method: "api_key" | "ad_token" | "ad_token_provider";
  azure_api_key?: string;
  azure_api_key_is_env_var?: boolean;
  azure_ad_token?: string;
  azure_ad_token_is_env_var?: boolean;
  azure_tenant_id?: string;
  azure_tenant_id_is_env_var?: boolean;
  azure_client_id?: string;
  azure_client_id_is_env_var?: boolean;
  azure_client_secret?: string;
  azure_client_secret_is_env_var?: boolean;
  azure_scope?: string;
  azure_scope_is_env_var?: boolean;
  // Advanced settings
  azure_default_headers?: string; // JSON as string
}

// Anthropic specific form data
export interface AnthropicFormData extends BaseProviderFormData {
  sdk: "ANTHROPIC";
  // Basic settings
  anthropic_api_key: string;
  anthropic_api_key_is_env_var?: boolean;
  anthropic_base_url?: string;
  anthropic_base_url_is_env_var?: boolean;
  // Advanced settings
  anthropic_default_headers?: string; // JSON as string
}

// AWS Bedrock specific form data
export interface AWSBedrockFormData extends BaseProviderFormData {
  sdk: "AWS_BEDROCK";
  aws_region: string;
  aws_region_is_env_var?: boolean;
  aws_access_key_id: string;
  aws_access_key_id_is_env_var?: boolean;
  aws_secret_access_key: string;
  aws_secret_access_key_is_env_var?: boolean;
  aws_session_token?: string;
  aws_session_token_is_env_var?: boolean;
}

// Google GenAI specific form data
export interface GoogleGenAIFormData extends BaseProviderFormData {
  sdk: "GOOGLE_GENAI";
  // Basic settings
  google_api_key: string;
  google_api_key_is_env_var?: boolean;
  // Advanced HTTP options
  google_base_url?: string;
  google_base_url_is_env_var?: boolean;
  google_headers?: string; // JSON as string
}

// DeepSeek specific form data
export interface DeepSeekFormData extends BaseProviderFormData {
  sdk: "OPENAI";
  provider: "deepseek";
  deepseek_api_key: string;
  deepseek_api_key_is_env_var?: boolean;
  deepseek_base_url?: string;
  deepseek_base_url_is_env_var?: boolean;
  deepseek_organization?: string;
  deepseek_organization_is_env_var?: boolean;
  deepseek_project?: string;
  deepseek_project_is_env_var?: boolean;
  deepseek_default_headers?: string;
}

// xAI specific form data
export interface XAIFormData extends BaseProviderFormData {
  sdk: "OPENAI";
  provider: "xai";
  xai_api_key: string;
  xai_api_key_is_env_var?: boolean;
  xai_base_url?: string;
  xai_base_url_is_env_var?: boolean;
  xai_organization?: string;
  xai_organization_is_env_var?: boolean;
  xai_project?: string;
  xai_project_is_env_var?: boolean;
  xai_default_headers?: string;
}

// Ollama specific form data
export interface OllamaFormData extends BaseProviderFormData {
  sdk: "OPENAI";
  provider: "ollama";
  ollama_base_url?: string;
  ollama_base_url_is_env_var?: boolean;
  ollama_organization?: string;
  ollama_organization_is_env_var?: boolean;
  ollama_project?: string;
  ollama_project_is_env_var?: boolean;
  ollama_default_headers?: string;
}

// Discriminated union of all provider form data types
export type ProviderFormData =
  | OpenAIFormData
  | AzureOpenAIFormData
  | AnthropicFormData
  | AWSBedrockFormData
  | GoogleGenAIFormData
  | DeepSeekFormData
  | XAIFormData
  | OllamaFormData;

export interface ProviderFormProps {
  onSubmit: (data: ProviderFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<ProviderFormData>;
  isSubmitting?: boolean;
}

/**
 * Helper component to integrate StringValueOrLookupField with react-hook-form
 * This manages both the value field and the corresponding _is_env_var field
 */
function StringValueOrLookupController({
  control,
  valueName,
  isEnvVarName,
  label,
  placeholder,
  envVarPlaceholder,
  description,
  isPassword = false,
  isRequired = false,
}: {
  control: Control<ProviderFormData>;
  valueName: string;
  isEnvVarName: string;
  label: string;
  placeholder?: string;
  envVarPlaceholder?: string;
  description?: string;
  isPassword?: boolean;
  isRequired?: boolean;
}) {
  return (
    <Controller
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name={valueName as any}
      control={control}
      rules={
        isRequired
          ? {
              validate: (value) => {
                if (!value || value.trim() === "") {
                  return `${label} is required`;
                }
                return true;
              },
            }
          : undefined
      }
      render={({ field: valueField, fieldState: { error } }) => (
        <Controller
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name={isEnvVarName as any}
          control={control}
          render={({ field: isEnvVarField }) => (
            <View>
              <StringValueOrLookupField
                label={label}
                value={(valueField.value as string) || ""}
                isEnvVar={!!isEnvVarField.value}
                onChange={(value, isEnvVar) => {
                  valueField.onChange(value);
                  isEnvVarField.onChange(isEnvVar);
                }}
                placeholder={placeholder}
                envVarPlaceholder={envVarPlaceholder}
                description={description}
                isPassword={isPassword}
                isRequired={isRequired}
              />
              {error && (
                <Text color="danger" size="S">
                  {error.message}
                </Text>
              )}
            </View>
          )}
        />
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
  const { control, handleSubmit, watch, setValue } = useForm<ProviderFormData>({
    defaultValues: initialValues || createDefaultFormData("OPENAI"),
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const sdk = watch("sdk");
  const provider = watch("provider");

  // Derive selected model provider from form state instead of separate state
  const selectedModelProvider = React.useMemo(() => {
    if (!provider) return "CUSTOM";

    // Find matching model provider from provider string
    const matchedProvider = Object.entries(modelProviderToProviderString).find(
      ([_, value]) => value === provider.toLowerCase()
    )?.[0] as ModelProvider | undefined;

    return matchedProvider || "CUSTOM";
  }, [provider]);

  const isCustomProvider = selectedModelProvider === "CUSTOM";

  // Handle ModelProvider selection - populate both provider string and SDK
  // Memoized to prevent unnecessary re-renders
  const handleModelProviderChange = React.useCallback(
    (newModelProvider: ModelProvider | "CUSTOM") => {
      if (newModelProvider === "CUSTOM") {
        // For custom, let user manually set provider and SDK
        setValue("provider", "");
        return;
      }

      // Set provider string and SDK based on selected ModelProvider
      setValue("provider", modelProviderToProviderString[newModelProvider]);
      const sdk = modelProviderToSDK[newModelProvider];
      if (sdk) {
        setValue("sdk", sdk);
      }

      // Set default auth method for Azure OpenAI (required field)
      if (newModelProvider === "AZURE_OPENAI" && !initialValues) {
        setValue("azure_auth_method", "api_key");
      }
    },
    [setValue, initialValues]
  );

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
              <Text slot="description">
                A unique name to identify this provider configuration
              </Text>
              {error && <FieldError>{error.message}</FieldError>}
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

        <Select
          aria-label="Model Provider"
          selectedKey={selectedModelProvider}
          onSelectionChange={(key) =>
            handleModelProviderChange(key as ModelProvider | "CUSTOM")
          }
          isDisabled={isSubmitting || !!initialValues}
          isRequired
        >
          <Label>Provider</Label>
          <Button>
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover>
            <ListBox>
              <SelectItem id="OPENAI" textValue="OpenAI">
                <Flex direction="row" gap="size-100" alignItems="center">
                  <GenerativeProviderIcon provider="OPENAI" height={16} />
                  <Text>OpenAI</Text>
                </Flex>
              </SelectItem>
              <SelectItem id="AZURE_OPENAI" textValue="Azure OpenAI">
                <Flex direction="row" gap="size-100" alignItems="center">
                  <GenerativeProviderIcon provider="AZURE_OPENAI" height={16} />
                  <Text>Azure OpenAI</Text>
                </Flex>
              </SelectItem>
              <SelectItem id="ANTHROPIC" textValue="Anthropic">
                <Flex direction="row" gap="size-100" alignItems="center">
                  <GenerativeProviderIcon provider="ANTHROPIC" height={16} />
                  <Text>Anthropic</Text>
                </Flex>
              </SelectItem>
              <SelectItem id="AWS" textValue="AWS Bedrock">
                <Flex direction="row" gap="size-100" alignItems="center">
                  <GenerativeProviderIcon provider="AWS" height={16} />
                  <Text>AWS Bedrock</Text>
                </Flex>
              </SelectItem>
              <SelectItem id="GOOGLE" textValue="Google GenAI">
                <Flex direction="row" gap="size-100" alignItems="center">
                  <GenerativeProviderIcon provider="GOOGLE" height={16} />
                  <Text>Google GenAI</Text>
                </Flex>
              </SelectItem>
              <SelectItem id="DEEPSEEK" textValue="DeepSeek">
                <Flex direction="row" gap="size-100" alignItems="center">
                  <GenerativeProviderIcon provider="DEEPSEEK" height={16} />
                  <Text>DeepSeek</Text>
                </Flex>
              </SelectItem>
              <SelectItem id="XAI" textValue="xAI">
                <Flex direction="row" gap="size-100" alignItems="center">
                  <GenerativeProviderIcon provider="XAI" height={16} />
                  <Text>xAI</Text>
                </Flex>
              </SelectItem>
              <SelectItem id="OLLAMA" textValue="Ollama">
                <Flex direction="row" gap="size-100" alignItems="center">
                  <GenerativeProviderIcon provider="OLLAMA" height={16} />
                  <Text>Ollama</Text>
                </Flex>
              </SelectItem>
              <SelectItem id="CUSTOM" textValue="Custom">
                <Flex direction="row" gap="size-100" alignItems="center">
                  <Icon svg={<Icons.SettingsOutline />} />
                  <Text>Custom</Text>
                </Flex>
              </SelectItem>
            </ListBox>
          </Popover>
        </Select>

        {isCustomProvider && (
          <Flex direction="row" gap="size-100" alignItems="start">
            <Controller
              name="sdk"
              control={control}
              rules={{ required: "SDK is required" }}
              render={({ field }) => (
                <Select
                  {...field}
                  selectedKey={field.value}
                  onSelectionChange={(key) =>
                    setValue("sdk", key as GenerativeModelCustomProviderSDK)
                  }
                  isDisabled={isSubmitting || !!initialValues}
                  isRequired
                >
                  <Label>SDK</Label>
                  <Button>
                    <SelectValue />
                    <SelectChevronUpDownIcon />
                  </Button>
                  <Popover>
                    <ListBox>
                      <SelectItem id="OPENAI" textValue="OpenAI">
                        OpenAI
                      </SelectItem>
                      <SelectItem id="AZURE_OPENAI" textValue="Azure OpenAI">
                        Azure OpenAI
                      </SelectItem>
                      <SelectItem id="ANTHROPIC" textValue="Anthropic">
                        Anthropic
                      </SelectItem>
                      <SelectItem id="AWS_BEDROCK" textValue="AWS Bedrock">
                        AWS Bedrock
                      </SelectItem>
                      <SelectItem id="GOOGLE_GENAI" textValue="Google GenAI">
                        Google GenAI
                      </SelectItem>
                    </ListBox>
                  </Popover>
                </Select>
              )}
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
                  isDisabled={isSubmitting || !!initialValues}
                  css={css`
                    flex: 1 1 auto;
                  `}
                >
                  <Label>Provider String</Label>
                  <Input placeholder="e.g., openai, azure, my-custom-provider" />
                  {error && <FieldError>{error.message}</FieldError>}
                </TextField>
              )}
            />
          </Flex>
        )}

        {sdk === "OPENAI" && (
          <OpenAIFields control={control} isSubmitting={isSubmitting} />
        )}

        {sdk === "AZURE_OPENAI" && (
          <AzureOpenAIFields
            control={control}
            isSubmitting={isSubmitting}
            watch={watch}
          />
        )}

        {sdk === "ANTHROPIC" && (
          <AnthropicFields control={control} isSubmitting={isSubmitting} />
        )}

        {sdk === "AWS_BEDROCK" && <AWSFields control={control} />}

        {sdk === "GOOGLE_GENAI" && (
          <GoogleFields control={control} isSubmitting={isSubmitting} />
        )}

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
}

function OpenAIFields({
  control,
  isSubmitting,
}: {
  control: Control<ProviderFormData>;
  isSubmitting: boolean;
}) {
  return (
    <View
      borderColor="grey-200"
      borderWidth="thin"
      borderRadius="medium"
      padding="size-200"
    >
      <Flex direction="column" gap="size-100">
        <Text weight="heavy">OpenAI Configuration</Text>

        <StringValueOrLookupController
          control={control}
          valueName="openai_api_key"
          isEnvVarName="openai_api_key_is_env_var"
          label="API Key"
          placeholder="sk-..."
          envVarPlaceholder="OPENAI_API_KEY"
          isPassword
        />

        <StringValueOrLookupController
          control={control}
          valueName="openai_base_url"
          isEnvVarName="openai_base_url_is_env_var"
          label="Base URL"
          placeholder="https://api.openai.com/v1"
          envVarPlaceholder="OPENAI_BASE_URL"
          description="Custom base URL for OpenAI-compatible endpoints"
        />

        <Flex direction="row" gap="size-100">
          <StringValueOrLookupController
            control={control}
            valueName="openai_organization"
            isEnvVarName="openai_organization_is_env_var"
            label="Organization"
            envVarPlaceholder="OPENAI_ORG_ID"
          />

          <StringValueOrLookupController
            control={control}
            valueName="openai_project"
            isEnvVarName="openai_project_is_env_var"
            label="Project"
            envVarPlaceholder="OPENAI_PROJECT_ID"
          />
        </Flex>

        {/* Advanced Settings */}
        <HeadersField
          name="openai_default_headers"
          control={control}
          label="Default Headers (JSON)"
          placeholder='{"X-Custom-Header": "value"}'
          description="Default HTTP headers sent with each request"
          isSubmitting={isSubmitting}
        />
      </Flex>
    </View>
  );
}

function AzureOpenAIFields({
  control,
  isSubmitting,
  watch,
}: {
  control: Control<ProviderFormData>;
  isSubmitting: boolean;
  watch: UseFormWatch<ProviderFormData>;
}) {
  const authMethod = watch("azure_auth_method") || "api_key";

  return (
    <View
      borderColor="grey-200"
      borderWidth="thin"
      borderRadius="medium"
      padding="size-200"
    >
      <Flex direction="column" gap="size-100">
        <Text weight="heavy">Azure OpenAI Configuration</Text>

        <StringValueOrLookupController
          control={control}
          valueName="azure_endpoint"
          isEnvVarName="azure_endpoint_is_env_var"
          label="Endpoint"
          placeholder="https://your-resource.openai.azure.com/"
          envVarPlaceholder="AZURE_OPENAI_ENDPOINT"
          isRequired
        />

        <StringValueOrLookupController
          control={control}
          valueName="azure_deployment_name"
          isEnvVarName="azure_deployment_name_is_env_var"
          label="Deployment Name"
          envVarPlaceholder="AZURE_OPENAI_DEPLOYMENT"
          isRequired
        />

        <StringValueOrLookupController
          control={control}
          valueName="azure_api_version"
          isEnvVarName="azure_api_version_is_env_var"
          label="API Version"
          placeholder="e.g., 2025-06-01"
          envVarPlaceholder="AZURE_OPENAI_API_VERSION"
          isRequired
        />

        <Controller
          name="azure_auth_method"
          control={control}
          defaultValue="api_key"
          rules={{ required: "Authentication method is required" }}
          render={({ field }) => (
            <Select
              {...field}
              selectedKey={field.value || "api_key"}
              onSelectionChange={(key) =>
                field.onChange(
                  key as "api_key" | "ad_token" | "ad_token_provider"
                )
              }
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
                  <SelectItem id="api_key" textValue="API Key">
                    API Key
                  </SelectItem>
                  <SelectItem id="ad_token" textValue="Azure AD Token">
                    Azure AD Token
                  </SelectItem>
                  <SelectItem
                    id="ad_token_provider"
                    textValue="Azure AD Token Provider"
                  >
                    Azure AD Token Provider
                  </SelectItem>
                </ListBox>
              </Popover>
            </Select>
          )}
        />

        {authMethod === "api_key" && (
          <StringValueOrLookupController
            control={control}
            valueName="azure_api_key"
            isEnvVarName="azure_api_key_is_env_var"
            label="API Key"
            envVarPlaceholder="AZURE_OPENAI_API_KEY"
            isPassword
          />
        )}

        {authMethod === "ad_token" && (
          <StringValueOrLookupController
            control={control}
            valueName="azure_ad_token"
            isEnvVarName="azure_ad_token_is_env_var"
            label="Azure AD Token"
            envVarPlaceholder="AZURE_AD_TOKEN"
            isPassword
          />
        )}

        {authMethod === "ad_token_provider" && (
          <>
            <StringValueOrLookupController
              control={control}
              valueName="azure_tenant_id"
              isEnvVarName="azure_tenant_id_is_env_var"
              label="Tenant ID"
              envVarPlaceholder="AZURE_TENANT_ID"
            />
            <StringValueOrLookupController
              control={control}
              valueName="azure_client_id"
              isEnvVarName="azure_client_id_is_env_var"
              label="Client ID"
              envVarPlaceholder="AZURE_CLIENT_ID"
            />
            <StringValueOrLookupController
              control={control}
              valueName="azure_client_secret"
              isEnvVarName="azure_client_secret_is_env_var"
              label="Client Secret"
              envVarPlaceholder="AZURE_CLIENT_SECRET"
              isPassword
            />
            <StringValueOrLookupController
              control={control}
              valueName="azure_scope"
              isEnvVarName="azure_scope_is_env_var"
              label="Scope"
              placeholder="https://cognitiveservices.azure.com/.default"
              envVarPlaceholder="AZURE_SCOPE"
              description="OAuth scope for Azure AD authentication (server default: https://cognitiveservices.azure.com/.default)"
            />
          </>
        )}

        {/* Advanced Settings */}
        <HeadersField
          name="azure_default_headers"
          control={control}
          label="Default Headers (JSON)"
          placeholder='{"X-Custom-Header": "value"}'
          description="Default HTTP headers sent with each request"
          isSubmitting={isSubmitting}
        />
      </Flex>
    </View>
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
    <View
      borderColor="grey-200"
      borderWidth="thin"
      borderRadius="medium"
      padding="size-200"
    >
      <Flex direction="column" gap="size-100">
        <Text weight="heavy">Anthropic Configuration</Text>

        <StringValueOrLookupController
          control={control}
          valueName="anthropic_api_key"
          isEnvVarName="anthropic_api_key_is_env_var"
          label="API Key"
          placeholder="sk-ant-..."
          envVarPlaceholder="ANTHROPIC_API_KEY"
          isPassword
        />

        <StringValueOrLookupController
          control={control}
          valueName="anthropic_base_url"
          isEnvVarName="anthropic_base_url_is_env_var"
          label="Base URL"
          placeholder="https://api.anthropic.com"
          envVarPlaceholder="ANTHROPIC_BASE_URL"
        />

        {/* Advanced Settings */}
        <HeadersField
          name="anthropic_default_headers"
          control={control}
          label="Default Headers (JSON)"
          placeholder='{"X-Custom-Header": "value"}'
          description="Default HTTP headers sent with each request"
          isSubmitting={isSubmitting}
        />
      </Flex>
    </View>
  );
}

function AWSFields({ control }: { control: Control<ProviderFormData> }) {
  return (
    <View
      borderColor="grey-200"
      borderWidth="thin"
      borderRadius="medium"
      padding="size-200"
    >
      <Flex direction="column" gap="size-100">
        <Text weight="heavy">AWS Bedrock Configuration</Text>

        <StringValueOrLookupController
          control={control}
          valueName="aws_region"
          isEnvVarName="aws_region_is_env_var"
          label="Region"
          placeholder="us-east-1"
          envVarPlaceholder="AWS_REGION"
          isRequired
        />

        <StringValueOrLookupController
          control={control}
          valueName="aws_access_key_id"
          isEnvVarName="aws_access_key_id_is_env_var"
          label="Access Key ID"
          envVarPlaceholder="AWS_ACCESS_KEY_ID"
          isPassword
        />

        <StringValueOrLookupController
          control={control}
          valueName="aws_secret_access_key"
          isEnvVarName="aws_secret_access_key_is_env_var"
          label="Secret Access Key"
          envVarPlaceholder="AWS_SECRET_ACCESS_KEY"
          isPassword
        />

        <StringValueOrLookupController
          control={control}
          valueName="aws_session_token"
          isEnvVarName="aws_session_token_is_env_var"
          label="Session Token"
          envVarPlaceholder="AWS_SESSION_TOKEN"
          isPassword
        />
      </Flex>
    </View>
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
    <View
      borderColor="grey-200"
      borderWidth="thin"
      borderRadius="medium"
      padding="size-200"
    >
      <Flex direction="column" gap="size-100">
        <Text weight="heavy">Google GenAI Configuration</Text>

        <StringValueOrLookupController
          control={control}
          valueName="google_api_key"
          isEnvVarName="google_api_key_is_env_var"
          label="API Key"
          placeholder="AIza..."
          envVarPlaceholder="GOOGLE_API_KEY"
          isPassword
        />

        <StringValueOrLookupController
          control={control}
          valueName="google_base_url"
          isEnvVarName="google_base_url_is_env_var"
          label="Base URL"
          envVarPlaceholder="GOOGLE_BASE_URL"
          description="Custom base URL for the AI platform service endpoint"
        />

        <HeadersField
          name="google_headers"
          control={control}
          label="Default Headers (JSON)"
          placeholder='{"X-Custom-Header": "value"}'
          description="Default HTTP headers sent with each request"
          isSubmitting={isSubmitting}
        />
      </Flex>
    </View>
  );
}
