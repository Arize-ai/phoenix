import { Control } from "react-hook-form";

import { Flex, Text, View } from "@phoenix/components";

import { HeadersField } from "../CustomProviderFormComponents";
import { ProviderFormData } from "../providerFormTypes";
import { StringValueOrLookupController } from "../StringValueOrLookupController";

export function AnthropicFields({
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
