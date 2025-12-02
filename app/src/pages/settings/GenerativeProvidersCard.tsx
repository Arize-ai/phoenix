import {
  createContext,
  type Dispatch,
  type SetStateAction,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { graphql, useFragment, useMutation } from "react-relay";
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
import {
  AllCredentialEnvVarNames,
  ProviderToCredentialsConfigMap,
} from "@phoenix/constants/generativeConstants";
import { useNotifyError, useNotifySuccess, useViewer } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import {
  GenerativeProvidersCard_data$data,
  GenerativeProvidersCard_data$key,
} from "./__generated__/GenerativeProvidersCard_data.graphql";
import type { GenerativeProvidersCardDeleteSecretMutation } from "./__generated__/GenerativeProvidersCardDeleteSecretMutation.graphql";
import type { GenerativeProvidersCardUpsertSecretMutation } from "./__generated__/GenerativeProvidersCardUpsertSecretMutation.graphql";

type Provider = GenerativeProvidersCard_data$data["modelProviders"][number];
type ProviderCredentialRequirement = Provider["credentialRequirements"][number];
type CredentialConfig = {
  envVarName: string;
  isRequired: boolean;
};

// Context for server secrets - avoids prop drilling and ref workarounds
type ServerSecretsContextValue = {
  serverSecretMap: Map<string, string>;
  unparsableSecrets: Map<string, string>;
  setServerSecretOverrides: Dispatch<SetStateAction<Map<string, string>>>;
};
const ServerSecretsContext = createContext<ServerSecretsContextValue | null>(
  null
);
ServerSecretsContext.displayName = "ServerSecretsContext";

function useServerSecrets() {
  const context = use(ServerSecretsContext);
  if (!context) {
    throw new Error(
      "useServerSecrets must be used within ServerSecretsContext.Provider"
    );
  }
  return context;
}

// Form state reducer for cleaner state management
type FormState = {
  values: Record<string, string>;
  initialValues: Record<string, string>;
};
type FormAction =
  | { type: "INITIALIZE"; values: Record<string, string> }
  | { type: "UPDATE_FIELD"; key: string; value: string }
  | { type: "MARK_SAVED"; keys: string[]; values: Record<string, string> }
  | { type: "MARK_DELETED"; keys: string[] };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "INITIALIZE":
      return { values: action.values, initialValues: action.values };
    case "UPDATE_FIELD":
      return {
        ...state,
        values: { ...state.values, [action.key]: action.value },
      };
    case "MARK_SAVED":
      return {
        values: { ...state.values, ...action.values },
        initialValues: { ...state.initialValues, ...action.values },
      };
    case "MARK_DELETED": {
      const emptyValues: Record<string, string> = {};
      action.keys.forEach((key) => {
        emptyValues[key] = "";
      });
      return {
        values: { ...state.values, ...emptyValues },
        initialValues: { ...state.initialValues, ...emptyValues },
      };
    }
  }
}
function useProviderCredentialConfigs(
  providerKey: string,
  credentialRequirements: ReadonlyArray<ProviderCredentialRequirement>
) {
  return useMemo<CredentialConfig[]>(() => {
    if (isModelProvider(providerKey)) {
      const configs = ProviderToCredentialsConfigMap[providerKey];
      if (configs) {
        return configs;
      }
    }
    return credentialRequirements.map(({ envVarName, isRequired }) => ({
      envVarName,
      isRequired,
    }));
  }, [providerKey, credentialRequirements]);
}

export function GenerativeProvidersCard({
  query,
}: {
  query: GenerativeProvidersCard_data$key;
}) {
  const data = useFragment<GenerativeProvidersCard_data$key>(
    graphql`
      fragment GenerativeProvidersCard_data on Query
      @argumentDefinitions(secretKeys: { type: "[String!]!" }) {
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
                ... on UnparsableSecret {
                  parseError
                }
              }
            }
          }
        }
      }
    `,
    query
  );

  const [serverSecretOverrides, setServerSecretOverrides] = useState<
    Map<string, string>
  >(new Map());

  // Track secrets and their parse errors
  const { serverSecretMap, unparsableSecrets } = useMemo(() => {
    const map = new Map<string, string>();
    const errors = new Map<string, string>();
    for (const { node } of data.secrets.edges) {
      const { value } = node;
      if (value.__typename === "UnparsableSecret") {
        // Track the parse error so we can show it to the user
        errors.set(node.key, value.parseError);
      } else if (value.__typename === "DecryptedSecret") {
        const secretValue = value.value;
        if (secretValue?.trim()) {
          map.set(node.key, secretValue.trim());
        }
      } else if (value.__typename === "MaskedSecret") {
        const secretValue = value.maskedValue;
        if (secretValue?.trim()) {
          map.set(node.key, secretValue.trim());
        }
      }
      // Ignore unknown types (%other)
    }
    for (const [key, value] of serverSecretOverrides.entries()) {
      if (value.trim()) {
        map.set(key, value.trim());
        errors.delete(key); // Clear error if we have an override
      } else {
        map.delete(key);
        errors.delete(key); // Clear error if deleted
      }
    }
    return { serverSecretMap: map, unparsableSecrets: errors };
  }, [data.secrets.edges, serverSecretOverrides]);

  // Memoize context value to prevent unnecessary re-renders
  const serverSecretsContextValue = useMemo(
    () => ({ serverSecretMap, unparsableSecrets, setServerSecretOverrides }),
    [serverSecretMap, unparsableSecrets]
  );

  const tableData = data.modelProviders;
  type DataRow = (typeof tableData)[number];
  // Columns are now stable - components read from context instead of props
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
          const credentialsConfig =
            ProviderToCredentialsConfigMap[row.original.key];
          const envVars =
            credentialsConfig?.map((config) => config.envVarName).join(", ") ||
            row.original.credentialRequirements
              .map((config) => config.envVarName)
              .join(", ") ||
            "--";
          return <Text>{envVars}</Text>;
        },
      },
      {
        header: "configuration",
        accessorKey: "credentialsSet",
        cell: ({ row }) => {
          return <ProviderCredentialsStatus provider={row.original} />;
        },
      },
      {
        header: "",
        accessorKey: "id",
        cell: ({ row }) => {
          return <ProviderEditButton provider={row.original} />;
        },
      },
    ] satisfies ColumnDef<DataRow>[];
  }, []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<(typeof tableData)[number]>({
    columns,
    data: tableData as (typeof tableData)[number][],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <ServerSecretsContext value={serverSecretsContextValue}>
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
    </ServerSecretsContext>
  );
}

function ProviderEditButton({
  provider,
}: {
  provider: GenerativeProvidersCard_data$data["modelProviders"][number];
}) {
  return (
    <Flex direction="row" justifyContent="end" gap="size-100" width="100%">
      <DialogTrigger>
        <Button size="S" leadingVisual={<Icon svg={<Icons.EditOutline />} />} />
        <ModalOverlay>
          <Modal size="M">
            <ProviderCredentialsDialog provider={provider} />
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </Flex>
  );
}

function ProviderCredentialsStatus({
  provider,
}: {
  provider: GenerativeProvidersCard_data$data["modelProviders"][number];
}) {
  const { serverSecretMap } = useServerSecrets();
  const credentials = useCredentialsContext((state) => state);
  const {
    dependenciesInstalled,
    credentialRequirements,
    key: providerKey,
    credentialsSet,
  } = provider;

  if (!dependenciesInstalled) {
    return <Text color="warning">missing dependencies</Text>;
  }

  if (!isModelProvider(providerKey)) {
    return <Text color="warning">unknown provider key</Text>;
  }

  // Providers with no credential requirements (e.g., Ollama) are always ready
  if (credentialRequirements.length === 0) {
    return <Text color="text-700">none required</Text>;
  }

  const providerCredentials = credentials[providerKey];

  const hasLocalCredentials = credentialRequirements.every(
    ({ envVarName, isRequired }) => {
      const envVarSet = !!providerCredentials?.[envVarName];
      return envVarSet || !isRequired;
    }
  );

  const hasServerSecrets = credentialRequirements.every(
    ({ envVarName, isRequired }) => {
      const value = serverSecretMap.get(envVarName)?.trim();
      return (value && value.length > 0) || !isRequired;
    }
  );

  // Collect configured sources
  const sources: string[] = [];
  if (hasLocalCredentials) sources.push("local");
  if (hasServerSecrets) sources.push("secrets");
  if (credentialsSet) sources.push("environment");

  if (sources.length === 0) {
    return <Text color="text-700">not configured</Text>;
  }

  return <Text color="success">{sources.join(" + ")}</Text>;
}

type CredentialViewType = "browser" | "secrets" | "environment";

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
          <DialogTitle>Configure {provider.name} Credentials</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
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
                if (
                  view === "browser" ||
                  view === "secrets" ||
                  view === "environment"
                ) {
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
              <ToggleButton aria-label="Environment" id="environment">
                Env
              </ToggleButton>
            </ToggleButtonGroup>
            {credentialView === "browser" && (
              <>
                <View>
                  <Text size="XS" color="text-700">
                    Credentials stored in your browser. Only you can see these,
                    and they are sent with each API request.
                  </Text>
                </View>
                <Form>
                  <BrowserCredentials
                    providerKey={provider.key}
                    credentialRequirements={provider.credentialRequirements}
                  />
                </Form>
              </>
            )}
            {credentialView === "secrets" && (
              <>
                <View>
                  <Text size="XS" color="text-700">
                    Credentials stored on the server. These are shared across
                    all users and persist across sessions.
                  </Text>
                </View>
                <Form>
                  <ServerCredentials
                    providerKey={provider.key}
                    credentialRequirements={provider.credentialRequirements}
                    isReadOnly={!isAdmin}
                  />
                </Form>
              </>
            )}
            {credentialView === "environment" && (
              <EnvironmentCredentials
                provider={provider}
                credentialRequirements={provider.credentialRequirements}
              />
            )}
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}

function EnvironmentCredentials({
  provider,
  credentialRequirements,
}: {
  provider: GenerativeProvidersCard_data$data["modelProviders"][number];
  credentialRequirements: ReadonlyArray<ProviderCredentialRequirement>;
}) {
  const credentialConfigs = useProviderCredentialConfigs(
    provider.key,
    credentialRequirements
  );

  if (credentialConfigs.length === 0) {
    return (
      <Text color="text-700">
        No environment variables required for this provider.
      </Text>
    );
  }

  return (
    <>
      <View>
        <Text size="XS" color="text-700">
          Environment variables are set on the server at startup.
        </Text>
      </View>
      <Flex direction="column" gap="size-100">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text weight="heavy">Status</Text>
          {provider.credentialsSet ? (
            <Flex direction="row" gap="size-50" alignItems="center">
              <Text color="success" size="S">
                Configured
              </Text>
              <Icon color="success" svg={<Icons.CheckmarkCircleOutline />} />
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
        <View
          borderColor="grey-300"
          borderWidth="thin"
          borderRadius="medium"
          padding="size-100"
        >
          <Flex direction="column" gap="size-50">
            {credentialConfigs.map((credentialConfig) => (
              <Text key={credentialConfig.envVarName} size="S" color="text-700">
                • {credentialConfig.envVarName}
                {credentialConfig.isRequired && (
                  <Text weight="heavy"> (required)</Text>
                )}
              </Text>
            ))}
          </Flex>
        </View>
      </Flex>
    </>
  );
}

function BrowserCredentials({
  providerKey,
  credentialRequirements,
}: {
  providerKey: ModelProvider;
  credentialRequirements: ReadonlyArray<ProviderCredentialRequirement>;
}) {
  const setCredential = useCredentialsContext((state) => state.setCredential);
  const credentialConfigs = useProviderCredentialConfigs(
    providerKey,
    credentialRequirements
  );
  const credentials = useCredentialsContext((state) => state[providerKey]);

  const clearLocalCredentials = useCallback(() => {
    credentialConfigs.forEach((credentialConfig) => {
      setCredential({
        provider: providerKey,
        envVarName: credentialConfig.envVarName,
        value: "",
      });
    });
  }, [providerKey, credentialConfigs, setCredential]);

  if (credentialConfigs.length === 0) {
    return <Text color="text-700">Browser credentials are not required.</Text>;
  }

  return (
    <Flex direction="column" gap="size-100">
      {credentialConfigs.map((credentialConfig) => (
        <CredentialField
          key={credentialConfig.envVarName}
          isRequired={credentialConfig.isRequired}
          onChange={(value) => {
            setCredential({
              provider: providerKey,
              envVarName: credentialConfig.envVarName,
              value,
            });
          }}
          value={credentials?.[credentialConfig.envVarName] ?? ""}
        >
          <Label>{credentialConfig.envVarName}</Label>
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
        Clear
      </Button>
    </Flex>
  );
}

function ServerCredentials({
  providerKey,
  credentialRequirements,
  isReadOnly = false,
}: {
  providerKey: ModelProvider;
  credentialRequirements: ReadonlyArray<ProviderCredentialRequirement>;
  isReadOnly?: boolean;
}) {
  const { serverSecretMap, unparsableSecrets, setServerSecretOverrides } =
    useServerSecrets();
  const credentialConfigs = useProviderCredentialConfigs(
    providerKey,
    credentialRequirements
  );
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  // Use reducer for cleaner state management of related form state
  const [formState, dispatch] = useReducer(formReducer, {
    values: {},
    initialValues: {},
  });

  // Initialize and update form when provider or secrets change
  useEffect(() => {
    const nextValues: Record<string, string> = {};
    credentialConfigs.forEach(({ envVarName }) => {
      const value = serverSecretMap.get(envVarName) ?? "";
      nextValues[envVarName] = value;
    });
    dispatch({ type: "INITIALIZE", values: nextValues });
  }, [providerKey, credentialConfigs, serverSecretMap]);

  const handleFieldChange = (envVarName: string, value: string) => {
    dispatch({ type: "UPDATE_FIELD", key: envVarName, value });
  };

  const [commitUpsert, isUpserting] =
    useMutation<GenerativeProvidersCardUpsertSecretMutation>(graphql`
      mutation GenerativeProvidersCardUpsertSecretMutation(
        $input: UpsertSecretMutationInput!
        $secretKeys: [String!]!
      ) {
        upsertSecret(input: $input) {
          query {
            ...GenerativeProvidersCard_data @arguments(secretKeys: $secretKeys)
          }
        }
      }
    `);

  const [commitDelete, isDeleting] =
    useMutation<GenerativeProvidersCardDeleteSecretMutation>(graphql`
      mutation GenerativeProvidersCardDeleteSecretMutation(
        $input: DeleteSecretMutationInput!
        $secretKeys: [String!]!
      ) {
        deleteSecret(input: $input) {
          query {
            ...GenerativeProvidersCard_data @arguments(secretKeys: $secretKeys)
          }
        }
      }
    `);

  const handleSaveAll = () => {
    const allSecrets = credentialConfigs.map((config) => ({
      key: config.envVarName,
      value: formState.values[config.envVarName]?.trim() ?? "",
      initialValue: formState.initialValues[config.envVarName]?.trim() ?? "",
    }));

    // Only save fields that have changed AND are non-empty
    const secretsToSave = allSecrets
      .filter((secret) => secret.value && secret.value !== secret.initialValue)
      .map(({ key, value }) => ({ key, value }));

    // Delete fields that are now empty but had a value initially
    const keysToDelete = allSecrets
      .filter((secret) => !secret.value && secret.initialValue)
      .map((secret) => secret.key);

    // If nothing to save and nothing to delete, do nothing
    if (secretsToSave.length === 0 && keysToDelete.length === 0) {
      return;
    }

    const performSave = () => {
      if (secretsToSave.length === 0) {
        return;
      }
      commitUpsert({
        variables: {
          input: { secrets: secretsToSave },
          secretKeys: AllCredentialEnvVarNames,
        },
        onCompleted: () => {
          // Update form state to reflect the new saved state
          const savedValues: Record<string, string> = {};
          secretsToSave.forEach((secret) => {
            savedValues[secret.key] = secret.value;
          });
          dispatch({
            type: "MARK_SAVED",
            keys: Object.keys(savedValues),
            values: savedValues,
          });
          setServerSecretOverrides((prev) => {
            const next = new Map(prev);
            secretsToSave.forEach((secret) => {
              next.set(secret.key, secret.value);
            });
            return next;
          });
          notifySuccess({
            title: "Secrets saved",
            message: `${secretsToSave.length} secret(s) saved${keysToDelete.length > 0 ? `, ${keysToDelete.length} deleted` : ""}`,
          });
        },
        onError: (error) => {
          notifyError({
            title: "Failed to save secrets",
            message: error instanceof Error ? error.message : String(error),
          });
        },
      });
    };

    // Handle deletions first, then save (sequential to avoid race conditions)
    if (keysToDelete.length > 0) {
      commitDelete({
        variables: {
          input: { keys: keysToDelete },
          secretKeys: AllCredentialEnvVarNames,
        },
        onCompleted: () => {
          // Update form state to reflect the deleted state
          dispatch({ type: "MARK_DELETED", keys: keysToDelete });
          setServerSecretOverrides((prev) => {
            const next = new Map(prev);
            keysToDelete.forEach((key) => {
              next.set(key, "");
            });
            return next;
          });
          // Now perform save if needed
          if (secretsToSave.length > 0) {
            performSave();
          } else {
            notifySuccess({
              title: "Secrets deleted",
              message: `${keysToDelete.length} secret(s) deleted`,
            });
          }
        },
        onError: (error) => {
          notifyError({
            title: "Failed to delete secrets",
            message: error instanceof Error ? error.message : String(error),
          });
        },
      });
    } else {
      // No deletions, just save
      performSave();
    }
  };

  // Get keys that have values on the server (based on initial form values)
  const existingSecretKeys = useMemo(
    () =>
      Object.entries(formState.initialValues)
        .filter(([, value]) => value.trim())
        .map(([key]) => key),
    [formState.initialValues]
  );

  const handleDeleteAll = () => {
    if (existingSecretKeys.length === 0) {
      return;
    }
    const keysToDelete = [...existingSecretKeys];
    commitDelete({
      variables: {
        input: { keys: keysToDelete },
        secretKeys: AllCredentialEnvVarNames,
      },
      onCompleted: () => {
        // Clear form values and initial values for deleted keys
        dispatch({ type: "MARK_DELETED", keys: keysToDelete });
        setServerSecretOverrides((prev) => {
          const next = new Map(prev);
          keysToDelete.forEach((key) => next.set(key, ""));
          return next;
        });
        notifySuccess({
          title: "Secrets deleted",
          message: `${keysToDelete.length} secret(s) removed from the server`,
        });
      },
      onError: (error) => {
        notifyError({
          title: "Failed to delete secrets",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    });
  };

  const isLoading = isUpserting || isDeleting;

  if (credentialConfigs.length === 0) {
    return (
      <Text color="text-700">
        Server-side credentials are not available for this provider.
      </Text>
    );
  }

  // Check if any credentials for this provider have parse errors
  const providerUnparsableSecrets = credentialConfigs
    .filter((config) => unparsableSecrets.has(config.envVarName))
    .map((config) => ({
      envVarName: config.envVarName,
      parseError: unparsableSecrets.get(config.envVarName)!,
    }));

  const handleDeleteUnparsable = (envVarName: string) => {
    commitDelete({
      variables: {
        input: { keys: [envVarName] },
        secretKeys: AllCredentialEnvVarNames,
      },
      onCompleted: () => {
        setServerSecretOverrides((prev) => {
          const next = new Map(prev);
          next.set(envVarName, "");
          return next;
        });
        notifySuccess({
          title: "Secret deleted",
          message: `Unparsable secret "${envVarName}" has been deleted`,
        });
      },
      onError: (error) => {
        notifyError({
          title: "Failed to delete secret",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    });
  };

  return (
    <Flex direction="column" gap="size-100">
      {providerUnparsableSecrets.map(({ envVarName, parseError }) => (
        <Alert
          key={envVarName}
          variant="danger"
          title={envVarName}
          extra={
            !isReadOnly && (
              <Button
                size="S"
                variant="danger"
                isDisabled={isLoading}
                onPress={() => handleDeleteUnparsable(envVarName)}
              >
                Delete
              </Button>
            )
          }
        >
          {parseError}
        </Alert>
      ))}
      {credentialConfigs
        .filter((config) => !unparsableSecrets.has(config.envVarName))
        .map((credentialConfig) => (
          <CredentialField
            key={credentialConfig.envVarName}
            isRequired={credentialConfig.isRequired}
            isDisabled={isReadOnly}
            onChange={(value) =>
              handleFieldChange(credentialConfig.envVarName, value)
            }
            value={formState.values[credentialConfig.envVarName] ?? ""}
          >
            <Label>{credentialConfig.envVarName}</Label>
            <CredentialInput disabled={isReadOnly} />
          </CredentialField>
        ))}
      {!isReadOnly && (
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
            isDisabled={isLoading}
            onPress={handleSaveAll}
          >
            Save
          </Button>
          {existingSecretKeys.length > 0 && (
            <Button
              variant="danger"
              isDisabled={isLoading}
              onPress={handleDeleteAll}
            >
              Delete All
            </Button>
          )}
        </Flex>
      )}
    </Flex>
  );
}
