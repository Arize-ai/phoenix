import React, { useState } from "react";
import { css } from "@emotion/react";

import {
  DropdownButton,
  DropdownMenu,
  DropdownTrigger,
  Form,
  TextField,
} from "@arizeai/components";

import { ExternalLink, Flex, Heading, Text, View } from "@phoenix/components";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
export const ProviderToCredentialNameMap: Record<ModelProvider, string> = {
  OPENAI: "OPENAI_API_KEY",
  ANTHROPIC: "ANTHROPIC_API_KEY",
  AZURE_OPENAI: "AZURE_OPENAI_API_KEY",
  GEMINI: "GEMINI_API_KEY",
};

export function PlaygroundCredentialsDropdown() {
  const currentProviders = usePlaygroundContext((state) =>
    Array.from(
      new Set(state.instances.map((instance) => instance.model.provider))
    )
  );
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  const setCredential = useCredentialsContext((state) => state.setCredential);
  const credentials = useCredentialsContext((state) => state);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div
      css={css`
        .ac-dropdown-button {
          min-width: 0px;
        }
      `}
    >
      <DropdownTrigger
        placement="bottom"
        isOpen={isOpen}
        onOpenChange={(isOpen) => {
          setIsOpen(isOpen);
        }}
      >
        <DropdownButton size="compact" isDisabled={isRunning}>
          API Keys
        </DropdownButton>
        <DropdownMenu>
          <View padding="size-200">
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                setIsOpen(false);
              }}
            >
              <Heading level={2} weight="heavy">
                API Keys
              </Heading>
              <View paddingY="size-50">
                <Text color="text-700" size="XS">
                  API keys are stored in your browser and used to communicate
                  with their respective API&apos;s.
                </Text>
              </View>
              <Flex direction="column" gap="size-100">
                {currentProviders.map((provider) => {
                  const credentialName = ProviderToCredentialNameMap[provider];
                  return (
                    <TextField
                      key={provider}
                      label={credentialName}
                      type="password"
                      isRequired
                      onChange={(value) => {
                        setCredential({ provider, value });
                      }}
                      value={credentials[provider]}
                      description={`Alternatively, you can set the "${credentialName}" environment variable on the phoenix server.`}
                    />
                  );
                })}
              </Flex>
              <View paddingTop="size-100">
                <Flex
                  direction="row"
                  gap="size-100"
                  width="100%"
                  justifyContent="end"
                >
                  <ExternalLink href="/settings">
                    View all AI provider configurations
                  </ExternalLink>
                </Flex>
              </View>
            </Form>
          </View>
        </DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
