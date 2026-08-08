import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

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
};

export type ProviderServerCredentialsPanelProvider = {
  readonly name: string;
  readonly key: string;
  readonly credentialRequirements: readonly ProviderCredentialRequirement[];
  readonly credentialsSet: boolean;
};

// Form values type for react-hook-form
type ServerCredentialsFormValues = Record<string, string>;

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

  // Used to trigger refetch after mutations
  const [fetchKey, setFetchKey] = useState(0);

  const secretsData =
    useLazyLoadQuery<ProviderServerCredentialsPanelSecretsQuery>(
      graphql`
        query ProviderServerCredentialsPanelSecretsQuery(
          $secretKeys: [String!]!
        ) {
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
        setFetchKey((k) => k + 1);
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

  const setViaServerEnvironment =
    provider.credentialsSet &&
    existingSecretKeys.length === 0 &&
    providerUnparsableSecrets.length === 0;

  return (
    <Flex direction="column" gap="size-100">
      {error && <Alert variant="danger">{error}</Alert>}
      {setViaServerEnvironment && (
        <Alert variant="info">
          Set via a server environment variable. This can only be cleared by
          removing the environment variable on the server.
        </Alert>
      )}
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
