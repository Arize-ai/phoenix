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
import { useNotifySuccess, useViewer } from "@phoenix/contexts";

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
};

// Form values type for react-hook-form
type ServerCredentialsFormValues = Record<string, string>;

export function ProviderServerCredentialsPanel({
  provider,
  onCredentialsUpdated,
}: {
  provider: ProviderServerCredentialsPanelProvider;
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
  provider: ProviderServerCredentialsPanelProvider;
  onCredentialsUpdated?: () => void;
}) {
  return (
    <>
      <View paddingBottom="size-100">
        <Text size="XS" color="text-700">
          Credentials are encrypted and stored in the database. These are shared
          across all users and override environment variables.
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

function ServerCredentials({
  provider,
  onCredentialsUpdated,
}: {
  provider: ProviderServerCredentialsPanelProvider;
  onCredentialsUpdated?: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const secretKeys = provider.credentialRequirements.map((c) => c.envVarName);

  const secretsData =
    useLazyLoadQuery<ProviderServerCredentialsPanelSecretsQuery>(
      graphql`
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
            Delete
          </Button>
        )}
        <Button
          variant="primary"
          isDisabled={isCommitting}
          isPending={isCommitting}
          onPress={() => handleSubmit(onSubmit)()}
        >
          Save
        </Button>
      </Flex>
    </Flex>
  );
}
