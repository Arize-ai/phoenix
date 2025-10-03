import { css } from "@emotion/react";

import {
  Button,
  CredentialField,
  CredentialInput,
  Dialog,
  DialogTrigger,
  ExternalLink,
  Flex,
  Form,
  Heading,
  Icon,
  Icons,
  Label,
  Popover,
  Text,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { ProviderToCredentialsConfigMap } from "@phoenix/constants/generativeConstants";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { getProviderName } from "@phoenix/utils/generativeUtils";

export function PlaygroundCredentialsDropdown() {
  const currentProviders = usePlaygroundContext((state) =>
    Array.from(
      new Set(state.instances.map((instance) => instance.model.provider))
    )
  );
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );

  return (
    <div
      css={css`
        .ac-dropdown-button {
          min-width: 0px;
        }
      `}
    >
      <DialogTrigger>
        <Button
          size="S"
          isDisabled={isRunning}
          trailingVisual={<Icon svg={<Icons.ChevronDown />} />}
        >
          API Keys
        </Button>
        <Popover>
          <Dialog>
            {({ close }) => (
              <View padding="size-200">
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                    close();
                  }}
                >
                  <Heading level={2} weight="heavy">
                    API Keys
                  </Heading>
                  <View paddingY="size-50">
                    <Text color="text-700" size="XS">
                      API keys are stored in your browser and used to
                      communicate with their respective APIs.
                    </Text>
                  </View>
                  <Flex direction="column" gap="size-100">
                    {currentProviders.map((provider) => {
                      const providerHasNoCredentials =
                        !ProviderToCredentialsConfigMap[provider].length;
                      if (providerHasNoCredentials) {
                        // Do not show the credential field
                        return null;
                      }
                      return (
                        <View key={provider} paddingY="size-50">
                          <Flex
                            direction="row"
                            gap="size-100"
                            alignItems="center"
                          >
                            <GenerativeProviderIcon provider={provider} />
                            <Heading level={3} weight="heavy">
                              {getProviderName(provider)}
                            </Heading>
                          </Flex>
                          <View paddingBottom="size-100" paddingTop="size-100">
                            <ProviderCredentials provider={provider} />
                          </View>
                        </View>
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
                      <ExternalLink href="/settings/providers">
                        View all AI provider configurations
                      </ExternalLink>
                    </Flex>
                  </View>
                </Form>
              </View>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  );
}

function ProviderCredentials({ provider }: { provider: ModelProvider }) {
  const setCredential = useCredentialsContext((state) => state.setCredential);
  const credentialsConfig = ProviderToCredentialsConfigMap[provider];
  const credentials = useCredentialsContext((state) => state[provider]);
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  return (
    <View>
      {credentialsConfig.map((credentialConfig) => (
        <CredentialField
          size="S"
          key={credentialConfig.envVarName}
          isRequired={credentialConfig.isRequired}
          onChange={(value) => {
            setCredential({
              provider,
              envVarName: credentialConfig.envVarName,
              value,
            });
          }}
          value={credentials?.[credentialConfig.envVarName] ?? ""}
          isDisabled={isRunning}
        >
          <Label>{credentialConfig.envVarName}</Label>
          <CredentialInput />
          <Text slot="description">
            {`Alternatively, you can set the "${credentialConfig.envVarName}" environment variable on the server.`}
          </Text>
        </CredentialField>
      ))}
    </View>
  );
}
