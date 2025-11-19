import { Control } from "react-hook-form";

import { Flex, Text, View } from "@phoenix/components";

import { HeadersField } from "../CustomProviderFormComponents";
import { ProviderFormData } from "../providerFormTypes";
import { StringValueOrLookupController } from "../StringValueOrLookupController";

export function OpenAIFields({
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
