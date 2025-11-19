import { Control } from "react-hook-form";

import { Flex, Text, View } from "@phoenix/components";

import { ProviderFormData } from "../providerFormTypes";
import { StringValueOrLookupController } from "../StringValueOrLookupController";

export function AWSBedrockFields({
  control,
}: {
  control: Control<ProviderFormData>;
}) {
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
