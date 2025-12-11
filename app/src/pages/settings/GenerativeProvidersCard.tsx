import { Suspense, useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Card,
  CredentialField,
  CredentialInput,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  FieldError,
  Flex,
  Form,
  Icon,
  Icons,
  Label,
  Modal,
  ModalOverlay,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import { tableCSS } from "@phoenix/components/table/styles";
import { useNotifyError, useNotifySuccess, useViewer } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import {
  GenerativeProvidersCard_data$data,
  GenerativeProvidersCard_data$key,
} from "./__generated__/GenerativeProvidersCard_data.graphql";
import type { GenerativeProvidersCardSecretsQuery } from "./__generated__/GenerativeProvidersCardSecretsQuery.graphql";
import type { GenerativeProvidersCardUpsertOrDeleteSecretsMutation } from "./__generated__/GenerativeProvidersCardUpsertOrDeleteSecretsMutation.graphql";

// Form values type for react-hook-form
type ServerCredentialsFormValues = Record<string, string>;

export function GenerativeProvidersCard({
  query,
}: {
  query: GenerativeProvidersCard_data$key;
}) {
  "use no memo";
  const data = useFragment<GenerativeProvidersCard_data$key>(
    graphql`
      fragment GenerativeProvidersCard_data on Query {
        modelProviders {
          name
          key
          dependenciesInstalled
          dependencies
          credentialRequirements {
            envVarName
            isRequired
          }
          credentialsSet
        }
      }
    `,
    query
  );

  const tableData = useMemo(() => [...data.modelProviders], [data]);
  type DataRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    return [
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => {
          return (
            <Flex direction="row" alignItems="center" gap="size-100">
              <GenerativeProviderIcon provider={row.original.key} height={18} />
              {row.original.name}
            </Flex>
          );
        },
      },
      {
        header: "Environment Variables",
        accessorKey: "apiKeyEnvVar",
        cell: ({ row }) => {
          const envVars =
            row.original.credentialRequirements
              .map((config) => config.envVarName)
              .join(", ") || "--";
          return <Text>{envVars}</Text>;
        },
      },
      {
        header: "Configuration",
        accessorKey: "credentialsSet",
        cell: ({ row }) => {
          return (
            <ProviderCredentialsStatus
              dependenciesInstalled={row.original.dependenciesInstalled}
              credentialRequirements={row.original.credentialRequirements}
              providerKey={row.original.key}
              credentialsSet={row.original.credentialsSet}
            />
          );
        },
      },
      {
        header: "",
        accessorKey: "id",
        cell: ({ row }) => {
          return (
            <Flex
              direction="row"
              justifyContent="end"
              gap="size-100"
              width="100%"
            >
              <DialogTrigger>
                <Button
                  size="S"
                  aria-label={`Edit ${row.original.name} credentials`}
                  leadingVisual={<Icon svg={<Icons.EditOutline />} />}
                  isDisabled={row.original.credentialRequirements.length === 0}
                />
                <ModalOverlay>
                  <Modal size="M">
                    <ProviderCredentialsDialog provider={row.original} />
                  </Modal>
                </ModalOverlay>
              </DialogTrigger>
            </Flex>
          );
        },
      },
    ] satisfies ColumnDef<DataRow>[];
  }, []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<(typeof tableData)[number]>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <Card title="AI Providers">
      <table css={tableCSS}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder ? null : (
                    <div>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => {
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function ProviderCredentialsStatus({
  dependenciesInstalled,
  credentialRequirements,
  providerKey,
  credentialsSet,
}: {
  dependenciesInstalled: boolean;
  credentialRequirements: GenerativeProvidersCard_data$data["modelProviders"][number]["credentialRequirements"];
  providerKey: GenerativeProvidersCard_data$data["modelProviders"][number]["key"];
  credentialsSet: boolean;
}) {
  const providerCredentials = useCredentialsContext((state) =>
    isModelProvider(providerKey) ? state[providerKey] : undefined
  );
  if (!dependenciesInstalled) {
    return <Text color="warning">missing dependencies</Text>;
  }

  // Check if any credentials are set locally
  if (!isModelProvider(providerKey)) {
    return <Text color="warning">unknown provider key</Text>;
  }
  const hasLocalCredentials = credentialRequirements.every(
    ({ envVarName, isRequired }) => {
      const envVarSet = !!providerCredentials?.[envVarName];
      return envVarSet || !isRequired;
    }
  );
  if (credentialRequirements.length === 0) {
    return <Text color="success">no credentials required</Text>;
  }
  if (hasLocalCredentials) {
    return <Text color="success">local</Text>;
  }
  if (credentialsSet) {
    return <Text color="success">configured on the server</Text>;
  }
  return <Text color="text-700">not configured</Text>;
}

type CredentialViewType = "browser" | "secrets";

function ProviderCredentialsDialog({
  provider,
}: {
  provider: GenerativeProvidersCard_data$data["modelProviders"][number];
}) {
  const { viewer } = useViewer();
  const isAdmin = !viewer || viewer.role?.name === "ADMIN";
  const [credentialView, setCredentialView] =
    useState<CredentialViewType>("browser");

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Configure {isAdmin ? "" : "Local "}
            {provider.name} Credentials
          </DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          {isAdmin ? (
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
                <>
                  <View paddingBottom="size-100">
                    <Text size="XS" color="text-700">
                      Credentials stored in the database. These are shared
                      across all users and override environment variables.
                    </Text>
                  </View>
                  <Suspense fallback={<Text color="text-700">Loading...</Text>}>
                    <Form>
                      <ServerCredentials provider={provider} />
                    </Form>
                  </Suspense>
                </>
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

function BrowserCredentials({
  provider,
}: {
  provider: GenerativeProvidersCard_data$data["modelProviders"][number];
}) {
  const providerKey = provider.key;
  const isValidProvider = isModelProvider(providerKey);

  const { setCredential, credentials } = useCredentialsContext((state) => ({
    setCredential: state.setCredential,
    credentials: isValidProvider ? state[providerKey] : undefined,
  }));
  const credentialRequirements = provider.credentialRequirements;

  const clearLocalCredentials = useCallback(() => {
    if (!isValidProvider) return;
    provider.credentialRequirements.forEach(({ envVarName }) => {
      setCredential({
        provider: providerKey,
        envVarName,
        value: "",
      });
    });
  }, [provider, providerKey, isValidProvider, setCredential]);

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
          margin-top: var(--ac-global-dimension-size-100);
        `}
      >
        Clear Local Credentials
      </Button>
    </Flex>
  );
}

function ServerCredentials({
  provider,
}: {
  provider: GenerativeProvidersCard_data$data["modelProviders"][number];
}) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  // Lazy load secrets only when this component mounts (admin opens secrets tab)
  const secretKeys = useMemo(
    () => provider.credentialRequirements.map((c) => c.envVarName),
    [provider.credentialRequirements]
  );

  // Used to trigger refetch after mutations
  const [fetchKey, setFetchKey] = useState(0);

  const secretsData = useLazyLoadQuery<GenerativeProvidersCardSecretsQuery>(
    graphql`
      query GenerativeProvidersCardSecretsQuery($secretKeys: [String!]!) {
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
  const { serverSecretMap, unparsableSecrets } = useMemo(() => {
    const map = new Map<string, string>();
    const errors = new Map<string, string>();
    for (const { node } of secretsData.secrets.edges) {
      const { value } = node;
      switch (value.__typename) {
        case "UnparsableSecret":
          errors.set(node.key, value.parseError);
          break;
        case "DecryptedSecret": {
          const secretValue = value.value;
          if (secretValue?.trim()) {
            map.set(node.key, secretValue.trim());
          }
          break;
        }
        case "%other":
        default:
          // Unknown secret type from server - treat as inaccessible
          errors.set(
            node.key,
            "Secret type not supported by this client version"
          );
          break;
      }
    }
    return { serverSecretMap: map, unparsableSecrets: errors };
  }, [secretsData.secrets.edges]);

  // Current secret values saved on the server (only successfully decrypted ones)
  const savedServerValues = useMemo(() => {
    const values: ServerCredentialsFormValues = {};
    provider.credentialRequirements.forEach(({ envVarName }) => {
      values[envVarName] = serverSecretMap.get(envVarName) ?? "";
    });
    return values;
  }, [provider, serverSecretMap]);

  const { control, handleSubmit, reset } = useForm<ServerCredentialsFormValues>(
    {
      defaultValues: savedServerValues,
      values: savedServerValues, // Syncs form when server data changes after refetch
    }
  );

  const [commit, isCommitting] =
    useMutation<GenerativeProvidersCardUpsertOrDeleteSecretsMutation>(graphql`
      mutation GenerativeProvidersCardUpsertOrDeleteSecretsMutation(
        $input: UpsertOrDeleteSecretsMutationInput!
      ) {
        upsertOrDeleteSecrets(input: $input) {
          __typename
        }
      }
    `);

  const onSubmit = useCallback(
    (formValues: ServerCredentialsFormValues) => {
      // Build list of secrets to upsert: value for save, null for delete
      const secretsToUpsert = provider.credentialRequirements
        .map((config) => {
          const newValue = formValues[config.envVarName]?.trim() || null;
          const savedValue =
            savedServerValues[config.envVarName]?.trim() || null;
          if (newValue === savedValue) return null; // No change
          return { key: config.envVarName, value: newValue };
        })
        .filter((s): s is { key: string; value: string | null } => s !== null);

      if (secretsToUpsert.length === 0) return;

      commit({
        variables: { input: { secrets: secretsToUpsert } },
        onCompleted: () => {
          setFetchKey((k) => k + 1);
          notifySuccess({
            title: "Secrets updated",
            message: `${secretsToUpsert.length} secret(s) updated`,
          });
        },
        onError: (error) => {
          notifyError({
            title: "Failed to update secrets",
            message: error instanceof Error ? error.message : String(error),
          });
        },
      });
    },
    [
      provider.credentialRequirements,
      savedServerValues,
      commit,
      notifySuccess,
      notifyError,
    ]
  );

  // Get keys that have values on the server (including unparsable secrets)
  const existingSecretKeys = useMemo(
    () => [
      ...Object.entries(savedServerValues)
        .filter(([, value]) => value.trim())
        .map(([key]) => key),
      ...unparsableSecrets.keys(),
    ],
    [savedServerValues, unparsableSecrets]
  );

  const handleDelete = useCallback(() => {
    if (existingSecretKeys.length === 0) return;

    const secretsToDelete = existingSecretKeys.map((key) => ({
      key,
      value: null,
    }));
    commit({
      variables: { input: { secrets: secretsToDelete } },
      onCompleted: () => {
        setFetchKey((k) => k + 1);
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
        notifyError({
          title: "Failed to delete secrets",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    });
  }, [
    existingSecretKeys,
    commit,
    provider.credentialRequirements,
    reset,
    notifySuccess,
    notifyError,
  ]);

  // Check if any credentials for this provider have parse errors
  const { providerUnparsableSecrets, editableConfigs } = useMemo(() => {
    const unparsable = provider.credentialRequirements
      .filter(({ envVarName }) => unparsableSecrets.has(envVarName))
      .map(({ envVarName }) => ({
        envVarName,
        parseError: unparsableSecrets.get(envVarName)!,
      }));
    const editable = provider.credentialRequirements.filter(
      ({ envVarName }) => !unparsableSecrets.has(envVarName)
    );
    return { providerUnparsableSecrets: unparsable, editableConfigs: editable };
  }, [provider.credentialRequirements, unparsableSecrets]);

  if (provider.credentialRequirements.length === 0) {
    return (
      <Text color="text-700">
        Server-side credentials are not available for this provider.
      </Text>
    );
  }

  return (
    <Flex direction="column" gap="size-100">
      {providerUnparsableSecrets.map(({ envVarName, parseError }) => (
        <Alert key={envVarName} variant="danger" title={envVarName}>
          {parseError}
        </Alert>
      ))}
      {editableConfigs.map((credentialConfig) => (
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
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <CredentialField
              isRequired={credentialConfig.isRequired}
              onChange={onChange}
              value={value ?? ""}
              isInvalid={!!error}
            >
              <Label>{credentialConfig.envVarName}</Label>
              <CredentialInput />
              {error?.message && <FieldError>{error.message}</FieldError>}
            </CredentialField>
          )}
        />
      ))}
      <Flex
        direction="row"
        gap="size-100"
        css={css`
          align-self: flex-start;
          margin-top: var(--ac-global-dimension-size-100);
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
