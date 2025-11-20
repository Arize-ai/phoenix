import { Control, Controller, UseFormWatch } from "react-hook-form";

import {
  Button,
  Flex,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  View,
} from "@phoenix/components";

import { HeadersField } from "../CustomProviderFormComponents";
import { ProviderFormData } from "../providerFormTypes";
import { StringValueOrLookupController } from "../StringValueOrLookupController";

export function AzureOpenAIFields({
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
