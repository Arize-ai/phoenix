import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Button,
  CredentialField,
  CredentialInput,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Form,
  Label,
  RedactedCredentialField,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  View,
} from "@phoenix/components";
import { useNotifySuccess, useViewer } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { ProviderCredentialsDialogSecretsQuery } from "./__generated__/ProviderCredentialsDialogSecretsQuery.graphql";
import type { ProviderCredentialsDialogUpsertOrDeleteSecretsMutation } from "./__generated__/ProviderCredentialsDialogUpsertOrDeleteSecretsMutation.graphql";

type CredentialViewType = "browser" | "secrets";

type ProviderCredentialRequirement = {
  readonly envVarName: string;
  readonly isRequired: boolean;
};

export type ProviderCredentialsDialogProvider = {
  readonly name: string;
  readonly key: string;
  readonly credentialRequirements: readonly ProviderCredentialRequirement[];
};

type ProviderCredentialsDialogMode = "browser-and-server" | "server-only";

// Form values type for react-hook-form
type ServerCredentialsFormValues = Record<string, string>;

export function ProviderCredentialsDialog({
  provider,
  mode = "browser-and-server",
  onCredentialsUpdated,
}: {
  provider: ProviderCredentialsDialogProvider;
  mode?: ProviderCredentialsDialogMode;
  onCredentialsUpdated?: () => void;
}) {
  const { viewer } = useViewer();
  const isAdmin = !viewer || viewer.role?.name === "ADMIN";
  const [credentialView, setCredentialView] =
    useState<CredentialViewType>("browser");
  const isServerOnly = mode === "server-only";

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Configure {isAdmin || isServerOnly ? "" : "Local "}
            {provider.name} Credentials
          </DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          {isServerOnly ? (
            <ProviderServerCredentialsPanel
              provider={provider}
              onCredentialsUpdated={onCredentialsUpdated}
            />
          ) : isAdmin ? (
            <Flex direction="column" gap="size-200">
              <ToggleButtonGroup
                selectedKeys={[credentialView]}
                size="S"
                aria-label="Credential Source"
                onSelectionChange={(v) => {
                  if (v.size === 0) {
                    return;
                  }
                  const view = v.keys().next().value as CredentialViewType;
                  if (view === "browser" || view === "secrets") {
                    setCredentialView(view);
                  }
                }}
              >
                <ToggleButton aria-label="Browser" id="browser">
                  Browser
                </ToggleButton>
                <ToggleButton aria-label="Secrets" id="secrets">
                  Secrets
                </ToggleButton>
              </ToggleButtonGroup>
              {credentialView === "browser" && (
                <>
                  <View paddingBottom="size-100">
                    <Text size="XS" color="text-700">
                      Credentials stored in your browser. Only you can see
                      these, and they are sent with each API request.
                    </Text>
                  </View>
                  <Form>
                    <BrowserCredentials provider={provider} />
                  </Form>
                </>
              )}
              {credentialView === "secrets" && (
                <ServerCredentialsSection
                  provider={provider}
                  onCredentialsUpdated={onCredentialsUpdated}
                />
              )}
            </Flex>
          ) : (
            <>
              <View paddingBottom="size-100">
                <Text size="XS">
                  Set the credentials for the {provider.name} API. These
                  credentials will be stored entirely in your browser and will
                  only be sent to the server during API requests.
                </Text>
              </View>
              <Form>
                <BrowserCredentials provider={provider} />
              </Form>
            </>
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}

export function ProviderServerCredentialsPanel({
  provider,
  onCredentialsUpdated,
}: {
  provider: ProviderCredentialsDialogProvider;
  onCredentialsUpdated?: () => void;
}) {
  const { viewer } = useViewer();
  const isAdmin = !viewer || viewer.role?.name === "ADMIN";

  if (!isAdmin) {
    return (
      <Text>
        PXI uses server-side credentials. Ask an administrator to configure{" "}
        {provider.name} credentials in AI provider settings.
      </Text>
    );
  }

  return (
    <ServerCredentialsSection
      provider={provider}
      onCredentialsUpdated={onCredentialsUpdated}
    />
  );
}

function ServerCredentialsSection({
  provider,
  onCredentialsUpdated,
}: {
  provider: ProviderCredentialsDialogProvider;
  onCredentialsUpdated?: () => void;
}) {
  return (
    <>
      <View paddingBottom="size-100">
        <Text size="XS" color="text-700">
          Credentials stored in the database. These are shared across all users
          and override environment variables.
        </Text>
      </View>
      <Suspense fallback={<Text color="text-700">Loading...</Text>}>
        <Form>
          <ServerCredentials
            provider={provider}
            onCredentialsUpdated={onCredentialsUpdated}
          />
        </Form>
      </Suspense>
    </>
  );
}

function BrowserCredentials({
  provider,
}: {
  provider: ProviderCredentialsDialogProvider;
}) {
  const providerKey = provider.key;
  const isValidProvider = isModelProvider(providerKey);

  const { setCredential, credentials } = useCredentialsContext((state) => ({
    setCredential: state.setCredential,
    credentials: isValidProvider ? state[providerKey] : undefined,
  }));
  const credentialRequirements = provider.credentialRequirements;

  const clearLocalCredentials = () => {
    if (!isValidProvider) return;
    provider.credentialRequirements.forEach(({ envVarName }) => {
      setCredential({
        provider: providerKey,
        envVarName,
        value: "",
      });
    });
  };

  if (!isValidProvider) {
    return <Text color="warning">Unknown provider type: {providerKey}</Text>;
  }

  if (provider.credentialRequirements.length === 0) {
    return <Text color="text-700">Browser credentials are not required.</Text>;
  }

  return (
    <Flex direction="column" gap="size-100">
      {credentialRequirements.map(({ envVarName, isRequired }) => (
        <CredentialField
          key={envVarName}
          isRequired={isRequired}
          onChange={(value) => {
            setCredential({
              provider: providerKey,
              envVarName,
              value,
            });
          }}
          value={credentials?.[envVarName] ?? ""}
        >
          <Label>{envVarName}</Label>
          <CredentialInput />
        </CredentialField>
      ))}
      <Button
        onPress={clearLocalCredentials}
        css={css`
          align-self: flex-start;
          margin-top: var(--global-dimension-size-100);
        `}
      >
        Clear Local Credentials
      </Button>
    </Flex>
  );
}

function ServerCredentials({
  provider,
  onCredentialsUpdated,
}: {
  provider: ProviderCredentialsDialogProvider;
  onCredentialsUpdated?: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const secretKeys = provider.credentialRequirements.map((c) => c.envVarName);

  const secretsData = useLazyLoadQuery<ProviderCredentialsDialogSecretsQuery>(
    graphql`
      query ProviderCredentialsDialogSecretsQuery($secretKeys: [String!]!) {
        secrets(keys: $secretKeys) {
          edges {
            node {
              key
              value {
                __typename
                ... on DecryptedSecret {
                  value
                }
                ... on UnparsableSecret {
                  parseError
                }
              }
            }
          }
        }
      }
    `,
    { secretKeys },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const serverSecretMap = new Map<string, string>();
  const unparsableSecrets = new Map<string, string>();
  for (const { node } of secretsData.secrets.edges) {
    const { value } = node;
    switch (value.__typename) {
      case "UnparsableSecret":
        unparsableSecrets.set(node.key, value.parseError);
        break;
      case "DecryptedSecret": {
        const secretValue = value.value;
        if (secretValue?.trim()) {
          serverSecretMap.set(node.key, secretValue.trim());
        }
        break;
      }
      case "%other":
      default:
        unparsableSecrets.set(
          node.key,
          "Secret type not supported by this client version"
        );
        break;
    }
  }

  const savedServerValues: ServerCredentialsFormValues = {};
  provider.credentialRequirements.forEach(({ envVarName }) => {
    savedServerValues[envVarName] = serverSecretMap.get(envVarName) ?? "";
  });

  const { control, handleSubmit, reset } = useForm<ServerCredentialsFormValues>(
    {
      defaultValues: savedServerValues,
      values: savedServerValues,
      mode: "onChange",
    }
  );

  const [commit, isCommitting] =
    useMutation<ProviderCredentialsDialogUpsertOrDeleteSecretsMutation>(
      graphql`
        mutation ProviderCredentialsDialogUpsertOrDeleteSecretsMutation(
          $input: UpsertOrDeleteSecretsMutationInput!
        ) {
          upsertOrDeleteSecrets(input: $input) {
            __typename
          }
        }
      `
    );

  const onSubmit = (formValues: ServerCredentialsFormValues) => {
    setError(null);
    const secretsToUpsert = provider.credentialRequirements
      .map((config) => {
        const newValue = formValues[config.envVarName]?.trim() || null;
        const savedValue = savedServerValues[config.envVarName]?.trim() || null;
        if (newValue === savedValue) return null;
        return { key: config.envVarName, value: newValue };
      })
      .filter((s): s is { key: string; value: string | null } => s !== null);

    if (secretsToUpsert.length === 0) return;

    commit({
      variables: { input: { secrets: secretsToUpsert } },
      onCompleted: () => {
        setFetchKey((k) => k + 1);
        onCredentialsUpdated?.();
        notifySuccess({
          title: "Secrets updated",
          message: `${secretsToUpsert.length} secret(s) updated`,
        });
      },
      onError: (error) => {
        setError(error instanceof Error ? error.message : String(error));
      },
    });
  };

  const existingSecretKeys = [
    ...Object.entries(savedServerValues)
      .filter(([, value]) => value.trim())
      .map(([key]) => key),
    ...unparsableSecrets.keys(),
  ];

  const handleDelete = () => {
    setError(null);
    if (existingSecretKeys.length === 0) return;

    const secretsToDelete = existingSecretKeys.map((key) => ({
      key,
      value: null,
    }));
    commit({
      variables: { input: { secrets: secretsToDelete } },
      onCompleted: () => {
        setFetchKey((k) => k + 1);
        onCredentialsUpdated?.();
        const emptyValues: ServerCredentialsFormValues = {};
        provider.credentialRequirements.forEach(({ envVarName }) => {
          emptyValues[envVarName] = "";
        });
        reset(emptyValues);
        notifySuccess({
          title: "Secrets deleted",
          message: `${existingSecretKeys.length} secret(s) removed`,
        });
      },
      onError: (error) => {
        setError(error instanceof Error ? error.message : String(error));
      },
    });
  };

  const providerUnparsableSecrets = provider.credentialRequirements
    .filter(({ envVarName }) => unparsableSecrets.has(envVarName))
    .map(({ envVarName }) => ({
      envVarName,
      parseError: unparsableSecrets.get(envVarName)!,
    }));

  if (provider.credentialRequirements.length === 0) {
    return (
      <Text color="text-700">
        Server-side credentials are not available for this provider.
      </Text>
    );
  }

  return (
    <Flex direction="column" gap="size-100">
      {error && <Alert variant="danger">{error}</Alert>}
      {providerUnparsableSecrets.map(({ envVarName, parseError }) => (
        <Alert key={envVarName} variant="danger" title={envVarName}>
          {parseError}
        </Alert>
      ))}
      {provider.credentialRequirements.map((credentialConfig) => (
        <Controller
          key={credentialConfig.envVarName}
          name={credentialConfig.envVarName}
          control={control}
          rules={{
            validate: credentialConfig.isRequired
              ? (value) =>
                  !!value?.trim() ||
                  `${credentialConfig.envVarName} is required`
              : undefined,
          }}
          render={({
            field: { name, onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <RedactedCredentialField
              label={credentialConfig.envVarName}
              isRequired={credentialConfig.isRequired}
              name={name}
              value={value ?? ""}
              onChange={onChange}
              onBlur={onBlur}
              errorMessage={error?.message}
            />
          )}
        />
      ))}
      <Flex
        direction="row"
        gap="size-100"
        css={css`
          align-self: flex-start;
          margin-top: var(--global-dimension-size-100);
        `}
      >
        <Button
          variant="primary"
          isDisabled={isCommitting}
          isPending={isCommitting}
          onPress={() => handleSubmit(onSubmit)()}
        >
          Save
        </Button>
        {existingSecretKeys.length > 0 && (
          <Button
            variant="danger"
            isDisabled={isCommitting}
            onPress={handleDelete}
          >
            Delete
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
