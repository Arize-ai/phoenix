import { Suspense, useMemo, useState } from "react";
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
import {
  AllCredentialEnvVarNames,
  ProviderToCredentialsConfigMap,
} from "@phoenix/constants/generativeConstants";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  getProviderName,
  isModelProvider,
} from "@phoenix/utils/generativeUtils";

import type { PlaygroundCredentialsDropdownEnvQuery } from "./__generated__/PlaygroundCredentialsDropdownEnvQuery.graphql";
import type { PlaygroundCredentialsDropdownQuery } from "./__generated__/PlaygroundCredentialsDropdownQuery.graphql";

type CredentialViewType = "local" | "secrets" | "environment";

export function PlaygroundCredentialsDropdown() {
  const currentProviders = usePlaygroundContext((state) =>
    Array.from(
      new Set(state.instances.map((instance) => instance.model.provider))
    )
  );
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );

  const [credentialView, setCredentialView] =
    useState<CredentialViewType>("local");

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
                        const view = v.keys().next()
                          .value as CredentialViewType;
                        if (
                          view === "local" ||
                          view === "secrets" ||
                          view === "environment"
                        ) {
                          setCredentialView(view);
                        }
                      }}
                    >
                      <ToggleButton aria-label="Local" id="local">
                        Local
                      </ToggleButton>
                      <ToggleButton aria-label="Secrets" id="secrets">
                        Secrets
                      </ToggleButton>
                      <ToggleButton aria-label="Environment" id="environment">
                        Env
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Flex>
                  {credentialView === "local" && (
                    <LocalCredentialsView providers={currentProviders} />
                  )}
                  {credentialView === "secrets" && (
                    <Suspense fallback={<CredentialsSkeleton />}>
                      <SecretsCredentialsView providers={currentProviders} />
                    </Suspense>
                  )}
                  {credentialView === "environment" && (
                    <Suspense fallback={<CredentialsSkeleton />}>
                      <EnvironmentCredentialsView
                        providers={currentProviders}
                      />
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
                        Manage AI provider settings
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

function CredentialsSkeleton() {
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

/**
 * Shows stored secrets (read-only)
 */
function SecretsCredentialsView({ providers }: { providers: ModelProvider[] }) {
  const data = useLazyLoadQuery<PlaygroundCredentialsDropdownQuery>(
    graphql`
      query PlaygroundCredentialsDropdownQuery($secretKeys: [String!]!) {
        modelProviders {
          key
          credentialRequirements {
            envVarName
            isRequired
          }
          credentialsSet
        }
        secrets(keys: $secretKeys) {
          edges {
            node {
              key
              value {
                __typename
                ... on DecryptedSecret {
                  value
                }
                ... on MaskedSecret {
                  maskedValue
                }
              }
            }
          }
        }
      }
    `,
    { secretKeys: AllCredentialEnvVarNames },
    { fetchPolicy: "network-only" }
  );

  // Build a map of secret key to value
  const secretsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const { node } of data.secrets.edges) {
      if (node.value.__typename === "DecryptedSecret" && node.value.value) {
        map.set(node.key, node.value.value);
      } else if (
        node.value.__typename === "MaskedSecret" &&
        node.value.maskedValue
      ) {
        map.set(node.key, node.value.maskedValue);
      }
    }
    return map;
  }, [data.secrets.edges]);

  return (
    <>
      <View paddingY="size-50">
        <Text color="text-700" size="XS">
          Server secrets are stored encrypted and shared across all users.
        </Text>
      </View>
      <Flex direction="column" gap="size-100">
        {providers.map((provider) => {
          const providerHasNoCredentials =
            !ProviderToCredentialsConfigMap[provider].length;
          if (providerHasNoCredentials) {
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
                <SecretsProviderCredentials
                  provider={provider}
                  secretsMap={secretsMap}
                />
              </View>
            </View>
          );
        })}
      </Flex>
    </>
  );
}

/**
 * Read-only display of stored secrets for a provider
 */
function SecretsProviderCredentials({
  provider,
  secretsMap,
}: {
  provider: ModelProvider;
  secretsMap: Map<string, string>;
}) {
  const credentialsConfig = ProviderToCredentialsConfigMap[provider];

  return (
    <View>
      {credentialsConfig.map((credentialConfig) => {
        const secretValue = secretsMap.get(credentialConfig.envVarName);
        const hasSecret = !!secretValue;

        return (
          <CredentialField
            size="S"
            key={credentialConfig.envVarName}
            isRequired={credentialConfig.isRequired}
            isDisabled
            value={secretValue ?? ""}
          >
            <Label>{credentialConfig.envVarName}</Label>
            <CredentialInput disabled />
            {hasSecret ? (
              <Text slot="description" color="success" size="XS">
                ✓ Configured
              </Text>
            ) : (
              <Text slot="description" color="text-700" size="XS">
                Not configured
              </Text>
            )}
          </CredentialField>
        );
      })}
    </View>
  );
}

/**
 * Shows environment variable status (read-only)
 */
function EnvironmentCredentialsView({
  providers,
}: {
  providers: ModelProvider[];
}) {
  const data = useLazyLoadQuery<PlaygroundCredentialsDropdownEnvQuery>(
    graphql`
      query PlaygroundCredentialsDropdownEnvQuery {
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

  // Build a map of provider key to credentialsSet status
  const providerEnvStatusMap = useMemo(() => {
    const map = new Map<string, boolean>();
    data.modelProviders.forEach((provider) => {
      if (isModelProvider(provider.key)) {
        map.set(provider.key, provider.credentialsSet);
      }
    });
    return map;
  }, [data.modelProviders]);

  return (
    <>
      <View paddingY="size-50">
        <Text color="text-700" size="XS">
          Environment variables are set on the server at startup.
        </Text>
      </View>
      <Flex direction="column" gap="size-100">
        {providers.map((provider) => {
          const credentialsConfig = ProviderToCredentialsConfigMap[provider];
          if (!credentialsConfig.length) {
            return null;
          }
          const credentialsSet = providerEnvStatusMap.get(provider);
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
    </>
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
          <Text slot="description" color="text-700" size="XS">
            Alternatively, use secrets / environment variables for server-side
            config
          </Text>
        </CredentialField>
      ))}
    </View>
  );
}
