import { css } from "@emotion/react";
import { useCallback, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
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
  Icon,
  Icons,
  Input,
  Label,
  Modal,
  ModalOverlay,
  NumberField,
  Switch,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { CanManageSandboxConfig } from "@phoenix/components/auth";
import { tableCSS } from "@phoenix/components/table/styles";
import { useSandboxCredentialsStore } from "@phoenix/store/sandboxCredentialsStore";

import type { SandboxBackendType } from "./__generated__/SettingsSandboxPageCreateMutation.graphql";
import type { SettingsSandboxPageCreateMutation } from "./__generated__/SettingsSandboxPageCreateMutation.graphql";
import type { SettingsSandboxPageDeleteMutation } from "./__generated__/SettingsSandboxPageDeleteMutation.graphql";
import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";
import type { SettingsSandboxPageUpdateMutation } from "./__generated__/SettingsSandboxPageUpdateMutation.graphql";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];

const monoCSS = css`
  font-family: var(--global-font-family-mono, monospace);
  font-size: var(--global-font-size-xs);
`;

const nameCellCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-25);
`;

function statusDisplay(status: string) {
  switch (status) {
    case "AVAILABLE":
      return { label: "active", color: "green-700" as const, icon: true };
    case "NOT_INSTALLED":
      return {
        label: "not installed",
        color: "gray-400" as const,
        icon: false,
      };
    case "NEEDS_CREDENTIALS":
      return {
        label: "needs credentials",
        color: "warning" as const,
        icon: false,
      };
    case "NEEDS_CONFIG":
      return { label: "needs config", color: "warning" as const, icon: false };
    default:
      return { label: status, color: "gray-400" as const, icon: false };
  }
}

export function SettingsSandboxPage() {
  const [sandboxesEnabled, setSandboxesEnabled] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);
  const credentials = useSandboxCredentialsStore((state) => state.credentials);

  const data = useLazyLoadQuery<SettingsSandboxPageQuery>(
    graphql`
      query SettingsSandboxPageQuery {
        sandboxBackends {
          key
          label
          description
          status
          envVars {
            name
            required
            description
          }
          configFields {
            key
            label
            placeholder
            description
          }
          configRequired
          hasSessionMode
          setupInstructions
          currentConfig {
            id
            backendType
            config
            timeout
            sessionMode
            configHash
          }
        }
      }
    `,
    {},
    {
      fetchKey,
      fetchPolicy: "network-only",
    }
  );

  const backends = data.sandboxBackends;

  return (
    <CanManageSandboxConfig>
      <Flex direction="column" gap="size-200">
        <Switch isSelected={sandboxesEnabled} onChange={setSandboxesEnabled}>
          Enable code sandboxing
        </Switch>
        <Card title="Python Sandbox Backends">
          <table css={tableCSS}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Environment Variable</th>
                <th>Credential</th>
                <th>Configuration</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {backends.map((adapter) => {
                const display = statusDisplay(adapter.status);
                const primaryEnvVar = adapter.envVars[0] ?? null;
                const hasCredential =
                  primaryEnvVar != null && !!credentials[primaryEnvVar.name];
                const isConfigurable =
                  adapter.configRequired ||
                  adapter.configFields.length > 0 ||
                  adapter.envVars.length > 0;
                return (
                  <tr key={adapter.key}>
                    <td>
                      <div css={nameCellCSS}>
                        <Flex
                          direction="row"
                          alignItems="center"
                          gap="size-100"
                        >
                          <Icon
                            svg={
                              display.icon ? (
                                <Icons.CheckmarkCircleOutline />
                              ) : (
                                <Icons.MinusCircleOutline />
                              )
                            }
                            color={display.color}
                          />
                          <Text weight="heavy">{adapter.label}</Text>
                        </Flex>
                        <Text size="XS" color="text-500">
                          {adapter.description}
                        </Text>
                      </div>
                    </td>
                    <td>
                      <Text css={monoCSS} color="text-700">
                        {primaryEnvVar?.name ?? "--"}
                      </Text>
                    </td>
                    <td>
                      {primaryEnvVar == null ? (
                        <Text color="text-300">--</Text>
                      ) : hasCredential ? (
                        <Text color="success">configured</Text>
                      ) : (
                        <Text color="text-300">not configured</Text>
                      )}
                    </td>
                    <td>
                      {adapter.status === "AVAILABLE" ? (
                        <Text color="success">active</Text>
                      ) : (
                        <Text color="text-300">{display.label}</Text>
                      )}
                    </td>
                    <td>
                      <Flex
                        direction="row"
                        justifyContent="end"
                        gap="size-100"
                        width="100%"
                      >
                        <DialogTrigger>
                          <Button
                            size="S"
                            aria-label={`Configure ${adapter.label}`}
                            leadingVisual={<Icon svg={<Icons.EditOutline />} />}
                            isDisabled={!isConfigurable}
                          />
                          <ModalOverlay>
                            <Modal size="M">
                              <ConfigureDialog
                                adapter={adapter}
                                onSaved={() => setFetchKey((k) => k + 1)}
                              />
                            </Modal>
                          </ModalOverlay>
                        </DialogTrigger>
                        <DialogTrigger>
                          <Button
                            size="S"
                            aria-label={`Setup instructions for ${adapter.label}`}
                            leadingVisual={<Icon svg={<Icons.InfoOutline />} />}
                          />
                          <ModalOverlay>
                            <Modal size="M">
                              <SetupDialog adapter={adapter} />
                            </Modal>
                          </ModalOverlay>
                        </DialogTrigger>
                      </Flex>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </Flex>
    </CanManageSandboxConfig>
  );
}

function SetupDialog({ adapter }: { adapter: AdapterInfo }) {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup: {adapter.label}</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-100">
            {adapter.setupInstructions.map((step, i) => (
              <Flex key={i} direction="row" gap="size-100" alignItems="start">
                <Text size="S" color="text-500" flex="none">
                  {i + 1}.
                </Text>
                <Text
                  size="S"
                  css={step.startsWith("pip install") ? monoCSS : undefined}
                  color="text-700"
                >
                  {step}
                </Text>
              </Flex>
            ))}
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}

function ConfigureDialog({
  adapter,
  onSaved,
}: {
  adapter: AdapterInfo;
  onSaved: () => void;
}) {
  const [configValues, setConfigValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(adapter.configFields.map((f) => [f.key, ""]))
  );
  const [timeout, setTimeout] = useState(adapter.currentConfig?.timeout ?? 30);
  const [sessionMode, setSessionMode] = useState(
    adapter.currentConfig?.sessionMode ?? false
  );
  const [error, setError] = useState<string | null>(null);

  const primaryEnvVar = adapter.envVars[0] ?? null;

  const credentialValue = useSandboxCredentialsStore((state) =>
    primaryEnvVar ? state.getCredential(primaryEnvVar.name) : undefined
  );
  const setCredential = useSandboxCredentialsStore(
    (state) => state.setCredential
  );

  const [commitCreate, isCreating] =
    useMutation<SettingsSandboxPageCreateMutation>(graphql`
      mutation SettingsSandboxPageCreateMutation($input: CreateSandboxConfigInput!) {
        createSandboxConfig(input: $input) {
          id
          backendType
          config
          timeout
          sessionMode
          configHash
        }
      }
    `);

  const [commitUpdate, isUpdating] =
    useMutation<SettingsSandboxPageUpdateMutation>(graphql`
      mutation SettingsSandboxPageUpdateMutation($input: UpdateSandboxConfigInput!) {
        updateSandboxConfig(input: $input) {
          id
          backendType
          config
          timeout
          sessionMode
          configHash
        }
      }
    `);

  const [commitDelete, isDeleting] =
    useMutation<SettingsSandboxPageDeleteMutation>(graphql`
      mutation SettingsSandboxPageDeleteMutation($id: ID!) {
        deleteSandboxConfig(id: $id) {
          id
        }
      }
    `);

  const isBusy = isCreating || isUpdating || isDeleting;

  const handleSave = useCallback(() => {
    setError(null);

    const credentials: Array<{ envVarName: string; value: string }> = [];
    if (primaryEnvVar && credentialValue) {
      credentials.push({
        envVarName: primaryEnvVar.name,
        value: credentialValue,
      });
    }

    const config: Record<string, string> = {};
    for (const field of adapter.configFields) {
      const val = configValues[field.key];
      if (val) {
        config[field.key] = val;
      }
    }

    const existingConfig = adapter.currentConfig;

    if (existingConfig) {
      commitUpdate({
        variables: {
          input: {
            id: existingConfig.id,
            config,
            timeout,
            sessionMode,
            credentials,
          },
        },
        onCompleted: () => onSaved(),
        onError: (err) => setError(err.message),
      });
    } else {
      commitCreate({
        variables: {
          input: {
            backendType: adapter.key as SandboxBackendType,
            config,
            timeout,
            sessionMode,
            credentials,
          },
        },
        onCompleted: () => onSaved(),
        onError: (err) => setError(err.message),
      });
    }
  }, [
    adapter,
    configValues,
    timeout,
    sessionMode,
    credentialValue,
    primaryEnvVar,
    commitCreate,
    commitUpdate,
    onSaved,
  ]);

  const handleDelete = useCallback(() => {
    setError(null);
    const existingConfig = adapter.currentConfig;
    if (!existingConfig) return;
    commitDelete({
      variables: { id: existingConfig.id },
      onCompleted: () => onSaved(),
      onError: (err) => setError(err.message),
    });
  }, [adapter, commitDelete, onSaved]);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure {adapter.label}</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            {primaryEnvVar != null && (
              <CredentialField
                value={credentialValue ?? ""}
                onChange={(val) => setCredential(primaryEnvVar.name, val)}
              >
                <Label>{primaryEnvVar.description || primaryEnvVar.name}</Label>
                <CredentialInput placeholder={`Enter ${primaryEnvVar.name}`} />
              </CredentialField>
            )}
            {adapter.configFields.map((field) => (
              <TextField
                key={field.key}
                value={configValues[field.key]}
                onChange={(val) =>
                  setConfigValues((prev) => ({ ...prev, [field.key]: val }))
                }
              >
                <Label>{field.label}</Label>
                <Input placeholder={field.placeholder} />
              </TextField>
            ))}
            <NumberField
              value={timeout}
              onChange={setTimeout}
              minValue={1}
              maxValue={300}
            >
              <Label>Timeout (seconds)</Label>
              <Input />
            </NumberField>
            {adapter.hasSessionMode && (
              <Switch isSelected={sessionMode} onChange={setSessionMode}>
                Reuse sandbox across runs
              </Switch>
            )}
            {error != null && (
              <Text size="S" color="danger">
                {error}
              </Text>
            )}
            <Flex direction="row" gap="size-100">
              <Button
                variant="primary"
                isDisabled={isBusy}
                onPress={handleSave}
              >
                {isCreating || isUpdating ? "Saving..." : "Save"}
              </Button>
              {adapter.currentConfig != null && (
                <Button
                  variant="default"
                  isDisabled={isBusy}
                  onPress={handleDelete}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              )}
            </Flex>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}
