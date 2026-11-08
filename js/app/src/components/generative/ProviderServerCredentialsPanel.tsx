import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay";

import {
  Alert,
  Button,
  Flex,
  Form,
  RedactedCredentialField,
  Text,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";

import type { ProviderServerCredentialsPanelSecretsQuery } from "./__generated__/ProviderServerCredentialsPanelSecretsQuery.graphql";
import type { ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation } from "./__generated__/ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation.graphql";

type ProviderCredentialRequirement = {
  readonly envVarName: string;
  readonly isRequired: boolean;
  readonly isSetInServerEnvironment: boolean;
};

const SET_IN_SERVER_ENVIRONMENT_PLACEHOLDER =
  "•••••••• (set via server environment variable)";

/**
 * Where a credential's effective server-side value comes from. A stored secret
 * takes precedence over an environment variable of the same name.
 */
type ServerCredentialSource =
  | "none"
  | "environment"
  | "stored"
  | "storedOverridingEnvironment";

const SERVER_CREDENTIAL_SOURCE_DESCRIPTIONS: Partial<
  Record<ServerCredentialSource, string>
> = {
  environment:
    "Set via a server environment variable. A value saved here overrides it.",
  storedOverridingEnvironment:
    "Overrides the server environment variable. Clear to go back to it.",
};

/**
 * Describes env vars as set on the server, e.g. "A is set via a server
 * environment variable" or "A, B are now set via server environment variables".
 */
function formatSetViaServerEnvironment(
  envVarNames: string[],
  { now = false }: { now?: boolean } = {}
) {
  const isSingle = envVarNames.length === 1;
  return [
    envVarNames.join(", "),
    isSingle ? "is" : "are",
    ...(now ? ["now"] : []),
    "set via",
    isSingle ? "a server environment variable" : "server environment variables",
  ].join(" ");
}

export type ProviderServerCredentialsPanelProvider = {
  readonly name: string;
  readonly key: string;
  readonly credentialRequirements: readonly ProviderCredentialRequirement[];
  readonly credentialsSet: boolean;
};

// Form values type for react-hook-form
type ServerCredentialsFormValues = Record<string, string>;

const secretsQuery = graphql`
  query ProviderServerCredentialsPanelSecretsQuery($secretKeys: [String!]!) {
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
`;

export function ProviderServerCredentialsPanel({
  provider,
  onCredentialsUpdated,
  onSaved,
}: {
  provider: ProviderServerCredentialsPanelProvider;
  onCredentialsUpdated?: () => void;
  /**
   * Called after the credentials are successfully saved
   */
  onSaved?: () => void;
}) {
  return (
    <>
      <View paddingBottom="size-100">
        <Text size="XS" color="text-700">
          Shared with all users. Stored encrypted and overrides server
          environment variables.
        </Text>
      </View>
      <Suspense fallback={<Text color="text-700">Loading...</Text>}>
        <Form>
          <ServerCredentials
            provider={provider}
            onCredentialsUpdated={onCredentialsUpdated}
            onSaved={onSaved}
          />
        </Form>
      </Suspense>
    </>
  );
}

function ServerCredentials({
  provider,
  onCredentialsUpdated,
  onSaved,
}: {
  provider: ProviderServerCredentialsPanelProvider;
  onCredentialsUpdated?: () => void;
  onSaved?: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);

  // Lazy load secrets only when this component mounts (admin opens secrets tab)
  const secretKeys = provider.credentialRequirements.map((c) => c.envVarName);

  const environment = useRelayEnvironment();
  const secretsData =
    useLazyLoadQuery<ProviderServerCredentialsPanelSecretsQuery>(
      secretsQuery,
      { secretKeys },
      { fetchPolicy: "store-and-network" }
    );

  // A fetchKey would restart at 0 on each mount and can collide with a query
  // Relay still caches from an earlier mount, skipping the request, so fetch
  // into the store directly instead
  const refreshSecrets = () => {
    fetchQuery<ProviderServerCredentialsPanelSecretsQuery>(
      environment,
      secretsQuery,
      { secretKeys },
      { fetchPolicy: "network-only" }
    ).subscribe({});
  };

  // Process secrets from query
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
        // Unknown secret type from server - treat as inaccessible
        unparsableSecrets.set(
          node.key,
          "Secret type not supported by this client version"
        );
        break;
    }
  }

  // Current secret values saved on the server (only successfully decrypted ones)
  const savedServerValues: ServerCredentialsFormValues = {};
  provider.credentialRequirements.forEach(({ envVarName }) => {
    savedServerValues[envVarName] = serverSecretMap.get(envVarName) ?? "";
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<ServerCredentialsFormValues>({
    defaultValues: savedServerValues,
    values: savedServerValues, // Syncs form when server data changes after refetch
    mode: "onChange",
  });

  const [commit, isCommitting] =
    useMutation<ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation>(
      graphql`
        mutation ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation(
          $input: UpsertOrDeleteSecretsMutationInput!
        ) {
          upsertOrDeleteSecrets(input: $input) {
            __typename
          }
        }
      `
    );

  const onSubmit = (formValues: ServerCredentialsFormValues) => {
    // Build list of secrets to upsert: value for save, null for delete
    const secretsToUpsert = provider.credentialRequirements
      .map((config) => {
        const newValue = formValues[config.envVarName]?.trim() || null;
        const savedValue = savedServerValues[config.envVarName]?.trim() || null;
        if (newValue === savedValue) return null; // No change
        return { key: config.envVarName, value: newValue };
      })
      .filter((s): s is { key: string; value: string | null } => s !== null);

    if (secretsToUpsert.length === 0) return;

    commit({
      variables: { input: { secrets: secretsToUpsert } },
      onCompleted: () => {
        refreshSecrets();
        onCredentialsUpdated?.();
        notifySuccess({
          title: "Secrets updated",
          message: `${secretsToUpsert.length} secret(s) updated`,
        });
        onSaved?.();
      },
      onError: (error) => {
        setError(error instanceof Error ? error.message : String(error));
      },
    });
  };

  // Get keys that have values on the server (including unparsable secrets)
  const existingSecretKeys = [
    ...Object.entries(savedServerValues)
      .filter(([, value]) => value.trim())
      .map(([key]) => key),
    ...unparsableSecrets.keys(),
  ];

  const handleDelete = () => {
    if (existingSecretKeys.length === 0) return;

    const secretsToDelete = existingSecretKeys.map((key) => ({
      key,
      value: null,
    }));
    commit({
      variables: { input: { secrets: secretsToDelete } },
      onCompleted: () => {
        refreshSecrets();
        onCredentialsUpdated?.();
        const emptyValues: ServerCredentialsFormValues = {};
        provider.credentialRequirements.forEach(({ envVarName }) => {
          emptyValues[envVarName] = "";
        });
        reset(emptyValues);
        const restoredEnvVarNames = provider.credentialRequirements
          .filter(
            ({ envVarName, isSetInServerEnvironment }) =>
              isSetInServerEnvironment &&
              existingSecretKeys.includes(envVarName)
          )
          .map(({ envVarName }) => envVarName);
        notifySuccess({
          title: "Secrets deleted",
          message:
            restoredEnvVarNames.length > 0
              ? `${existingSecretKeys.length} secret(s) removed. ${formatSetViaServerEnvironment(restoredEnvVarNames, { now: true })}.`
              : `${existingSecretKeys.length} secret(s) removed`,
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

  const getServerCredentialSource = ({
    envVarName,
    isSetInServerEnvironment,
  }: ProviderCredentialRequirement): ServerCredentialSource => {
    if (unparsableSecrets.has(envVarName)) {
      // The unparsable-secret alert already explains this field's state
      return "none";
    }
    if (serverSecretMap.has(envVarName)) {
      return isSetInServerEnvironment
        ? "storedOverridingEnvironment"
        : "stored";
    }
    return isSetInServerEnvironment ? "environment" : "none";
  };

  const environmentOnlyEnvVarNames = provider.credentialRequirements
    .filter(
      (credentialConfig) =>
        getServerCredentialSource(credentialConfig) === "environment"
    )
    .map(({ envVarName }) => envVarName);

  return (
    <Flex direction="column" gap="size-100">
      {error && <Alert variant="danger">{error}</Alert>}
      {environmentOnlyEnvVarNames.length > 0 && (
        <Alert variant="info">
          {formatSetViaServerEnvironment(environmentOnlyEnvVarNames)} and can
          only be removed on the server.
        </Alert>
      )}
      {providerUnparsableSecrets.map(({ envVarName, parseError }) => (
        <Alert key={envVarName} variant="danger" title={envVarName}>
          {parseError}
        </Alert>
      ))}
      {provider.credentialRequirements.map((credentialConfig) => {
        const source = getServerCredentialSource(credentialConfig);
        return (
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
                placeholder={
                  source === "environment"
                    ? SET_IN_SERVER_ENVIRONMENT_PLACEHOLDER
                    : undefined
                }
                description={SERVER_CREDENTIAL_SOURCE_DESCRIPTIONS[source]}
                errorMessage={error?.message}
              />
            )}
          />
        );
      })}
      <Flex
        direction="row"
        gap="size-100"
        justifyContent="end"
        width="100%"
        css={css`
          margin-top: var(--global-dimension-size-100);
        `}
      >
        {existingSecretKeys.length > 0 && (
          <Button
            variant="danger"
            isDisabled={isCommitting}
            onPress={handleDelete}
          >
            Clear
          </Button>
        )}
        <Button
          variant={isDirty ? "primary" : "default"}
          isDisabled={!isDirty || isCommitting}
          isPending={isCommitting}
          onPress={() => handleSubmit(onSubmit)()}
        >
          Save
        </Button>
      </Flex>
    </Flex>
  );
}
