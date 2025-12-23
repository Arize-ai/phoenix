import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
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
  Skeleton,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { ProviderToCredentialsConfigMap } from "@phoenix/constants/generativeConstants";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  getProviderName,
  isModelProvider,
} from "@phoenix/utils/generativeUtils";

import type { PlaygroundCredentialsDropdownQuery } from "./__generated__/PlaygroundCredentialsDropdownQuery.graphql";

export function PlaygroundCredentialsDropdown() {
  const currentProviders = usePlaygroundContext((state) =>
    Array.from(
      new Set(state.instances.map((instance) => instance.model.provider))
    )
  );
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );

  const [credentialView, setCredentialView] = useState<"local" | "server">(
    "local"
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
          leadingVisual={<Icon svg={<Icons.KeyOutline />} />}
        >
          API Keys
        </Button>
        <Popover style={{ width: "500px" }}>
          <Dialog>
            {({ close }) => (
              <View padding="size-200">
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                    close();
                  }}
                >
                  <Flex
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Heading level={2} weight="heavy">
                      API Keys
                    </Heading>
                    <ToggleButtonGroup
                      selectedKeys={[credentialView]}
                      size="S"
                      aria-label="Credential Source"
                      onSelectionChange={(v) => {
                        if (v.size === 0) {
                          return;
                        }
                        const view = v.keys().next().value;
                        if (view === "local" || view === "server") {
                          setCredentialView(view);
                        }
                      }}
                    >
                      <ToggleButton aria-label="Local" id="local">
                        Local
                      </ToggleButton>
                      <ToggleButton aria-label="Server" id="server">
                        Server
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Flex>
                  {credentialView === "local" ? (
                    <LocalCredentialsView providers={currentProviders} />
                  ) : (
                    <Suspense fallback={<ServerCredentialsSkeleton />}>
                      <ServerCredentialsView providers={currentProviders} />
                    </Suspense>
                  )}
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

function ServerCredentialsSkeleton() {
  return (
    <View paddingY="size-100">
      <Skeleton width="100%" height={20} animation="wave" />
      <View paddingTop="size-100">
        <Flex direction="column" gap="size-100">
          <View paddingY="size-50">
            <Flex direction="row" gap="size-100" alignItems="center">
              <Skeleton width={24} height={24} borderRadius="circle" />
              <Skeleton width={120} height={20} animation="wave" />
            </Flex>
            <View paddingTop="size-100">
              <Flex direction="column" gap="size-50">
                <Skeleton width="80%" height={16} animation="wave" />
                <Skeleton width="70%" height={16} animation="wave" />
              </Flex>
            </View>
          </View>
        </Flex>
      </View>
    </View>
  );
}

function LocalCredentialsView({ providers }: { providers: ModelProvider[] }) {
  return (
    <>
      <View paddingY="size-50">
        <Text color="text-700" size="XS">
          Local API keys are stored in your browser and are not shared with
          other users.
        </Text>
      </View>
      <Flex direction="column" gap="size-100">
        {providers.map((provider) => {
          const providerHasNoCredentials =
            !ProviderToCredentialsConfigMap[provider].length;
          if (providerHasNoCredentials) {
            // Do not show the credential field
            return null;
          }
          return (
            <View key={provider} paddingY="size-50">
              <Flex direction="row" gap="size-100" alignItems="center">
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
    </>
  );
}

function ServerCredentialsView({ providers }: { providers: ModelProvider[] }) {
  const data = useLazyLoadQuery<PlaygroundCredentialsDropdownQuery>(
    graphql`
      query PlaygroundCredentialsDropdownQuery {
        modelProviders {
          key
          credentialRequirements {
            envVarName
            isRequired
          }
          credentialsSet
        }
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );

  // Create a map of provider key to credentialsSet status
  const credentialsStatusMap = new Map<ModelProvider, boolean | undefined>();
  data.modelProviders.forEach((provider) => {
    if (isModelProvider(provider.key)) {
      credentialsStatusMap.set(provider.key, provider.credentialsSet);
    }
  });

  return (
    <View paddingY="size-100">
      <Text color="text-700" size="S">
        Server-side API keys are configured via environment variables and will
        be available to all users.
      </Text>
      <View paddingTop="size-100">
        <Flex direction="column" gap="size-100">
          {providers.map((provider) => {
            const credentialsConfig = ProviderToCredentialsConfigMap[provider];
            if (!credentialsConfig.length) {
              return null;
            }
            const credentialsSet = credentialsStatusMap.get(provider);
            return (
              <View key={provider} paddingY="size-50">
                <Flex
                  direction="row"
                  gap="size-100"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <GenerativeProviderIcon provider={provider} />
                    <Heading level={3} weight="heavy">
                      {getProviderName(provider)}
                    </Heading>
                  </Flex>
                  {credentialsSet ? (
                    <Flex direction="row" gap="size-50" alignItems="center">
                      <Text color="success" size="S">
                        Configured
                      </Text>
                      <Icon
                        color="success"
                        svg={<Icons.CheckmarkCircleOutline />}
                      />
                    </Flex>
                  ) : (
                    <Flex direction="row" gap="size-50" alignItems="center">
                      <Text color="text-700" size="S">
                        Not Configured
                      </Text>
                      <Icon svg={<Icons.MinusCircleOutline />} />
                    </Flex>
                  )}
                </Flex>
                <View paddingTop="size-100">
                  <Flex direction="column" gap="size-50">
                    {credentialsConfig.map((credentialConfig) => (
                      <Text
                        key={credentialConfig.envVarName}
                        color="text-600"
                        size="S"
                      >
                        • {credentialConfig.envVarName}
                        {credentialConfig.isRequired && (
                          <Text color="text-700" weight="heavy">
                            {" "}
                            (required)
                          </Text>
                        )}
                      </Text>
                    ))}
                  </Flex>
                </View>
              </View>
            );
          })}
        </Flex>
      </View>
    </View>
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
