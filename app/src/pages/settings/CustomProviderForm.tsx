import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { fetchQuery, graphql, useRelayEnvironment } from "react-relay";
import { zodResolver } from "@hookform/resolvers/zod";
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

import type { CustomProviderFormTestCredentialsQuery } from "./__generated__/CustomProviderFormTestCredentialsQuery.graphql";
import type { GenerativeModelCustomProviderSDK } from "./__generated__/CustomProvidersCard_data.graphql";
import { HeadersField } from "./CustomProviderFormComponents";
import { providerFormSchema } from "./customProviderFormSchema";
import {
  buildClientConfig,
  createDefaultFormData,
} from "./customProviderFormUtils";

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
 * Azure OpenAI SDK configuration.
 * Supports both API key and Azure AD token provider authentication.
 */
export interface AzureOpenAIFormData extends BaseProviderFormData {
  sdk: "AZURE_OPENAI";
  azure_endpoint: string;
  azure_deployment_name: string;
  azure_api_version: string;
  azure_auth_method: "api_key" | "ad_token_provider";
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
  initialValues?: Partial<ProviderFormData>;
  isSubmitting?: boolean;
  /**
   * Callback when form dirty state changes. Use this to warn before closing.
   */
  onDirtyStateChange?: (isDirty: boolean) => void;
}

// Form context to avoid prop drilling
interface FormContextValue {
  isSubmitting: boolean;
  isEditing: boolean;
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

  return (
    <Controller
      name={name}
      control={control}
      rules={isRequired ? { required: `${label} is required` } : undefined}
      render={({ field }) => (
        <Select
          {...field}
          selectedKey={field.value ?? options[0]?.id}
          onSelectionChange={(key) => field.onChange(key)}
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

// SDK-specific field configurations
const SDK_OPTIONS = [
  { id: "OPENAI", label: "OpenAI" },
  { id: "AZURE_OPENAI", label: "Azure OpenAI" },
  { id: "ANTHROPIC", label: "Anthropic" },
  { id: "AWS_BEDROCK", label: "AWS Bedrock" },
  { id: "GOOGLE_GENAI", label: "Google GenAI" },
] as const;

const AUTH_METHOD_OPTIONS = [
  { id: "api_key", label: "API Key" },
  { id: "ad_token_provider", label: "Azure AD Token Provider" },
] as const;

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
          type="password"
          control={control}
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
            description="OAuth scope for Azure AD authentication (server default: https://cognitiveservices.azure.com/.default)"
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
  sdk: GenerativeModelCustomProviderSDK;
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
    default:
      return null;
  }
}

/**
 * Custom hook to handle SDK changes.
 * When SDK changes (and not editing), reset SDK-specific fields while preserving shared fields.
 */
function useSDKChangeHandler(
  sdk: GenerativeModelCustomProviderSDK,
  isEditing: boolean,
  reset: UseFormReset<ProviderFormData>,
  getValues: UseFormGetValues<ProviderFormData>
) {
  const previousSDKRef = useRef<GenerativeModelCustomProviderSDK>(sdk);

  useEffect(() => {
    // Only reset for new providers, not when editing
    if (isEditing) return;

    // Only reset if SDK actually changed
    if (sdk === previousSDKRef.current) return;
    previousSDKRef.current = sdk;

    // Preserve shared fields when switching SDK
    const currentValues = getValues();
    const newDefaults = createDefaultFormData(sdk);

    reset({
      ...newDefaults,
      name: currentValues.name || "",
      description: currentValues.description || "",
      provider: currentValues.provider || "",
    });
  }, [sdk, isEditing, reset, getValues]);
}

/**
 * Custom hook to track and report dirty state changes.
 */
function useDirtyStateTracker(
  isDirty: boolean,
  onDirtyStateChange?: (isDirty: boolean) => void
) {
  const previousDirtyRef = useRef(isDirty);

  useEffect(() => {
    if (previousDirtyRef.current !== isDirty) {
      previousDirtyRef.current = isDirty;
      onDirtyStateChange?.(isDirty);
    }
  }, [isDirty, onDirtyStateChange]);
}

export function ProviderForm({
  onSubmit,
  onCancel,
  initialValues,
  isSubmitting = false,
  onDirtyStateChange,
}: ProviderFormProps) {
  const defaultValues = initialValues || createDefaultFormData("OPENAI");

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

  const sdk = useWatch({ control, name: "sdk" });
  const isEditing = !!initialValues;

  // Handle SDK changes - reset form fields when SDK changes
  useSDKChangeHandler(sdk, isEditing, reset, getValues);

  // Track dirty state changes
  useDirtyStateTracker(isDirty, onDirtyStateChange);

  // Memoize context value to prevent unnecessary re-renders
  const formContextValue = useMemo(
    () => ({ isSubmitting, isEditing }),
    [isSubmitting, isEditing]
  );

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
            <FormSelect
              name="sdk"
              label="SDK"
              options={SDK_OPTIONS}
              control={control}
              isRequired
              isDisabled={isEditing}
            />
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

          <TestCredentialsButton control={control} sdk={sdk} />

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
                : isEditing
                  ? "Update Provider"
                  : "Create Provider"}
            </Button>
          </Flex>
        </Flex>
      </Form>
    </FormContext>
  );
}

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
  "azure_deployment_name",
  "azure_api_version",
  "azure_api_key",
  "azure_auth_method",
  "azure_tenant_id",
  "azure_client_id",
  "azure_client_secret",
  "anthropic_api_key",
  "aws_region",
  "aws_access_key_id",
  "aws_secret_access_key",
  "google_api_key",
] as const;

/**
 * Check if required credential fields are filled for the selected SDK
 */
function hasRequiredCredentials(
  sdk: GenerativeModelCustomProviderSDK,
  credentials: Record<string, string | undefined>
): boolean {
  switch (sdk) {
    case "OPENAI":
      return Boolean(credentials.openai_api_key);
    case "AZURE_OPENAI": {
      const hasBaseConfig =
        credentials.azure_endpoint &&
        credentials.azure_deployment_name &&
        credentials.azure_api_version;
      const authMethod = credentials.azure_auth_method || "api_key";
      if (authMethod === "api_key") {
        return Boolean(hasBaseConfig && credentials.azure_api_key);
      }
      return Boolean(
        hasBaseConfig &&
          credentials.azure_tenant_id &&
          credentials.azure_client_id &&
          credentials.azure_client_secret
      );
    }
    case "ANTHROPIC":
      return Boolean(credentials.anthropic_api_key);
    case "AWS_BEDROCK":
      return Boolean(
        credentials.aws_region &&
          credentials.aws_access_key_id &&
          credentials.aws_secret_access_key
      );
    case "GOOGLE_GENAI":
      return Boolean(credentials.google_api_key);
    default:
      return false;
  }
}

function TestCredentialsButton({
  control,
  sdk,
}: {
  control: Control<ProviderFormData>;
  sdk: GenerativeModelCustomProviderSDK;
}) {
  const environment = useRelayEnvironment();
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Watch only the credential-related fields, not the entire form
  const watchedCredentials = useWatch({
    control,
    name: CREDENTIAL_FIELDS as unknown as ProviderFormFieldPath[],
  });

  // Build a lookup object from watched values
  const credentialValues = useMemo(() => {
    const result: Record<string, string | undefined> = {};
    CREDENTIAL_FIELDS.forEach((field, index) => {
      result[field] = watchedCredentials[index] as string | undefined;
    });
    return result;
  }, [watchedCredentials]);

  // Track component mount status for async safety
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset test status when SDK changes
  useEffect(() => {
    setTestStatus("idle");
    setErrorMessage(null);
  }, [sdk]);

  const canTest = hasRequiredCredentials(sdk, credentialValues);

  const handleTest = useCallback(async () => {
    if (!canTest) return;

    setTestStatus("testing");
    setErrorMessage(null);

    try {
      // Get all form values to build the client config
      const formValues = control._getWatch() as ProviderFormData;
      const clientConfig = buildClientConfig(formValues);
      const result = await fetchQuery<CustomProviderFormTestCredentialsQuery>(
        environment,
        testCredentialsQuery,
        { input: clientConfig }
      ).toPromise();

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      const error = result?.testGenerativeModelCustomProviderCredentials.error;

      if (!error) {
        setTestStatus("valid");
      } else {
        setTestStatus("invalid");
        setErrorMessage(error);
      }
    } catch (err) {
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;
      setTestStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Test failed");
    }
  }, [canTest, environment, control]);

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
