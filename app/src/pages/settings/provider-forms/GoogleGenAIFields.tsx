import { Control } from "react-hook-form";

import { Flex, Text, View } from "@phoenix/components";

import { HeadersField } from "../CustomProviderFormComponents";
import { ProviderFormData } from "../providerFormTypes";
import { StringValueOrLookupController } from "../StringValueOrLookupController";

export function GoogleGenAIFields({
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
