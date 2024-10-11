import React from "react";

import {
  DropdownButton,
  DropdownMenu,
  DropdownTrigger,
  Flex,
  Form,
  Heading,
  Text,
  TextField,
  View,
} from "@arizeai/components";

import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { CredentialKey } from "@phoenix/store";

export const ProviderToCredentialKeyMap: Record<ModelProvider, CredentialKey> =
  {
    OpenAI: "OPENAI_API_KEY",
    Anthropic: "ANTHROPIC_API_KEY",
    "Azure OpenAI": "AZURE_OPENAI_API_KEY",
  };

export function PlaygroundCredentialsDropdown() {
  const currentProviders = usePlaygroundContext((state) =>
    state.instances.map((instance) => instance.provider)
  );
  const setCredential = useCredentialsContext((state) => state.setCredential);
  const credentials = useCredentialsContext((state) => state);
  return (
    <DropdownTrigger placement="bottom">
      <DropdownButton size="compact">API Keys</DropdownButton>
      <DropdownMenu>
        <View padding="size-200">
          <Flex direction={"column"} gap={"size-100"}>
            <Heading level={2} weight="heavy">
              API Keys
            </Heading>
            <Text color="white70">
              API keys are stored in your browser and used to communicate with
              their respective API&apos;s.
            </Text>
            <Form>
              {currentProviders.map((provider) => {
                const credentialKey = ProviderToCredentialKeyMap[provider];
                return (
                  <TextField
                    key={provider}
                    label={credentialKey}
                    type="password"
                    isRequired
                    onChange={(value) => {
                      setCredential({ credential: credentialKey, value });
                    }}
                    value={credentials[credentialKey]}
                  />
                );
              })}
            </Form>
          </Flex>
        </View>
      </DropdownMenu>
    </DropdownTrigger>
  );
}
