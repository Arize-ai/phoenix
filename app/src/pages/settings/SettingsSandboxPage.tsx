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
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CanManageSandboxConfig } from "@phoenix/components/auth";
import { tableCSS } from "@phoenix/components/table/styles";

import type { SettingsSandboxPageCreateInstanceMutation } from "./__generated__/SettingsSandboxPageCreateInstanceMutation.graphql";
import type { SandboxBackendType } from "./__generated__/SettingsSandboxPageCreateMutation.graphql";
import type { SettingsSandboxPageDeleteCredentialMutation } from "./__generated__/SettingsSandboxPageDeleteCredentialMutation.graphql";
import type { SettingsSandboxPageDeleteInstanceMutation } from "./__generated__/SettingsSandboxPageDeleteInstanceMutation.graphql";
import type { SettingsSandboxPageQuery } from "./__generated__/SettingsSandboxPageQuery.graphql";
import type { SettingsSandboxPageSetBackendEnabledMutation } from "./__generated__/SettingsSandboxPageSetBackendEnabledMutation.graphql";
import type { SettingsSandboxPageSetCredentialMutation } from "./__generated__/SettingsSandboxPageSetCredentialMutation.graphql";
import type { SettingsSandboxPageSetEnabledMutation } from "./__generated__/SettingsSandboxPageSetEnabledMutation.graphql";
import type { SettingsSandboxPageUpdateInstanceMutation } from "./__generated__/SettingsSandboxPageUpdateInstanceMutation.graphql";

type AdapterInfo =
  SettingsSandboxPageQuery["response"]["sandboxBackends"][number];
type ConfigInstanceInfo = AdapterInfo["configs"][number];

const monoCSS = css`
  font-family: var(--global-font-family-mono, monospace);
  font-size: var(--global-font-size-xs);
`;

const nameCellCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-25);
`;

const instanceRowCSS = css`
  background: var(--ac-global-color-grey-75);
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
  const [fetchKey, setFetchKey] = useState(0);

  const data = useLazyLoadQuery<SettingsSandboxPageQuery>(
    graphql`
      query SettingsSandboxPageQuery {
        sandboxEnabled
        sandboxBackends {
          key
          label
          description
          status
          enabled
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
          setupInstructions
          configs {
            id
            backendType
            name
            description
            config
            timeout
            enabled
            configHash
            createdAt
            updatedAt
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
  const sandboxEnabled = data.sandboxEnabled;

  const [commitSetEnabled] =
    useMutation<SettingsSandboxPageSetEnabledMutation>(graphql`
      mutation SettingsSandboxPageSetEnabledMutation($enabled: Boolean!) {
        setSandboxEnabled(enabled: $enabled)
      }
    `);

  const [commitSetBackendEnabled] =
    useMutation<SettingsSandboxPageSetBackendEnabledMutation>(graphql`
      mutation SettingsSandboxPageSetBackendEnabledMutation(
        $backendType: SandboxBackendType!
        $enabled: Boolean!
      ) {
        setSandboxBackendEnabled(backendType: $backendType, enabled: $enabled) {
          id
          enabled
        }
      }
    `);

  const handleGlobalToggle = useCallback(
    (enabled: boolean) => {
      commitSetEnabled({
        variables: { enabled },
        onCompleted: () => setFetchKey((k) => k + 1),
      });
    },
    [commitSetEnabled]
  );

  const handleBackendToggle = useCallback(
    ({
      backendType,
      enabled,
    }: {
      backendType: SandboxBackendType;
      enabled: boolean;
    }) => {
      commitSetBackendEnabled({
        variables: { backendType, enabled },
        onCompleted: () => setFetchKey((k) => k + 1),
      });
    },
    [commitSetBackendEnabled]
  );

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  return (
    <CanManageSandboxConfig>
      <Flex direction="column" gap="size-200">
        <Card
          title="Python Sandbox Backends"
          extra={
            <Flex direction="row" alignItems="center" gap="size-100">
              <Text size="S" color={sandboxEnabled ? "text-700" : "text-300"}>
                {sandboxEnabled ? "Enabled" : "Disabled"}
              </Text>
              <Switch
                isSelected={sandboxEnabled}
                onChange={handleGlobalToggle}
                aria-label="Enable sandbox"
              >
                {null}
              </Switch>
            </Flex>
          }
        >
          <table css={tableCSS}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Environment Variable</th>
                <th>Credential</th>
                <th>Status</th>
                <th>Enabled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {backends.map((adapter) => {
                const display = statusDisplay(adapter.status);
                const primaryEnvVar = adapter.envVars[0] ?? null;
                return (
                  <BackendSection
                    key={adapter.key}
                    adapter={adapter}
                    display={display}
                    primaryEnvVar={primaryEnvVar}
                    sandboxEnabled={sandboxEnabled}
                    onBackendToggle={handleBackendToggle}
                    onRefetch={refetch}
                  />
                );
              })}
            </tbody>
          </table>
        </Card>
      </Flex>
    </CanManageSandboxConfig>
  );
}

function BackendSection({
  adapter,
  display,
  primaryEnvVar,
  sandboxEnabled,
  onBackendToggle,
  onRefetch,
}: {
  adapter: AdapterInfo;
  display: ReturnType<typeof statusDisplay>;
  primaryEnvVar: AdapterInfo["envVars"][number] | null;
  sandboxEnabled: boolean;
  onBackendToggle: (args: {
    backendType: SandboxBackendType;
    enabled: boolean;
  }) => void;
  onRefetch: () => void;
}) {
  return (
    <>
      {/* Backend header row */}
      <tr>
        <td>
          <div css={nameCellCSS}>
            <Flex direction="row" alignItems="center" gap="size-100">
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
          ) : adapter.status === "AVAILABLE" ||
            adapter.status === "NEEDS_CONFIG" ? (
            <Text color="success">configured</Text>
          ) : adapter.status === "NEEDS_CREDENTIALS" ? (
            <Text color="text-300">not configured</Text>
          ) : (
            <Text color="text-300">--</Text>
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
          <Switch
            isSelected={adapter.enabled}
            onChange={(enabled) =>
              onBackendToggle({
                backendType: adapter.key as SandboxBackendType,
                enabled,
              })
            }
            aria-label={`Enable ${adapter.label}`}
            isDisabled={!sandboxEnabled}
          >
            {null}
          </Switch>
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
                aria-label={`Configure credentials for ${adapter.label}`}
                leadingVisual={<Icon svg={<Icons.EditOutline />} />}
                isDisabled={adapter.envVars.length === 0}
              />
              <ModalOverlay>
                <Modal size="M">
                  <CredentialDialog adapter={adapter} onSaved={onRefetch} />
                </Modal>
              </ModalOverlay>
            </DialogTrigger>
            <DialogTrigger>
              <Button
                size="S"
                aria-label={`Add config for ${adapter.label}`}
                leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
              />
              <ModalOverlay>
                <Modal size="M">
                  <CreateInstanceDialog adapter={adapter} onSaved={onRefetch} />
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
      {/* Config instance rows */}
      {adapter.configs.map((instance) => (
        <tr key={instance.id} css={instanceRowCSS}>
          <td>
            <Flex direction="row" alignItems="center" gap="size-100">
              <View paddingStart="size-300">
                <Text size="S">{instance.name}</Text>
              </View>
            </Flex>
          </td>
          <td colSpan={2}>
            <Text size="XS" color="text-500">
              {instance.description || "--"}
            </Text>
          </td>
          <td>
            <Text size="XS" color="text-500">
              timeout: {instance.timeout}s
            </Text>
          </td>
          <td>
            <Text size="XS" color={instance.enabled ? "success" : "text-300"}>
              {instance.enabled ? "enabled" : "disabled"}
            </Text>
          </td>
          <td>
            <Flex direction="row" justifyContent="end" gap="size-100">
              <DialogTrigger>
                <Button
                  size="S"
                  aria-label={`Edit config ${instance.name}`}
                  leadingVisual={<Icon svg={<Icons.EditOutline />} />}
                />
                <ModalOverlay>
                  <Modal size="M">
                    <EditInstanceDialog
                      adapter={adapter}
                      instance={instance}
                      onSaved={onRefetch}
                    />
                  </Modal>
                </ModalOverlay>
              </DialogTrigger>
            </Flex>
          </td>
        </tr>
      ))}
    </>
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

function CredentialDialog({
  adapter,
  onSaved,
}: {
  adapter: AdapterInfo;
  onSaved: () => void;
}) {
  const [credentialValue, setCredentialValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const primaryEnvVar = adapter.envVars[0] ?? null;

  const [commitSetCredential, isSettingCredential] =
    useMutation<SettingsSandboxPageSetCredentialMutation>(graphql`
      mutation SettingsSandboxPageSetCredentialMutation(
        $envVarName: String!
        $value: String!
      ) {
        setSandboxCredential(envVarName: $envVarName, value: $value)
      }
    `);

  const [commitDeleteCredential, isDeletingCredential] =
    useMutation<SettingsSandboxPageDeleteCredentialMutation>(graphql`
      mutation SettingsSandboxPageDeleteCredentialMutation($envVarName: String!) {
        deleteSandboxCredential(envVarName: $envVarName)
      }
    `);

  const isBusy = isSettingCredential || isDeletingCredential;

  const handleSave = useCallback(() => {
    if (!primaryEnvVar) return;
    setError(null);

    if (credentialValue) {
      commitSetCredential({
        variables: {
          envVarName: primaryEnvVar.name,
          value: credentialValue,
        },
        onCompleted: () => onSaved(),
        onError: (err) => setError(err.message),
      });
    } else {
      commitDeleteCredential({
        variables: { envVarName: primaryEnvVar.name },
        onCompleted: () => onSaved(),
        onError: (err) => setError(err.message),
      });
    }
  }, [
    primaryEnvVar,
    credentialValue,
    commitSetCredential,
    commitDeleteCredential,
    onSaved,
  ]);

  if (!primaryEnvVar) return null;

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credentials: {adapter.label}</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <CredentialField
              value={credentialValue}
              onChange={setCredentialValue}
            >
              <Label>{primaryEnvVar.description || primaryEnvVar.name}</Label>
              <CredentialInput placeholder={`Enter ${primaryEnvVar.name}`} />
            </CredentialField>
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
                {isBusy ? "Saving..." : "Save"}
              </Button>
            </Flex>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}

function CreateInstanceDialog({
  adapter,
  onSaved,
}: {
  adapter: AdapterInfo;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(adapter.configFields.map((f) => [f.key, ""]))
  );
  const [timeout, setTimeout] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const [commitCreate, isCreating] =
    useMutation<SettingsSandboxPageCreateInstanceMutation>(graphql`
      mutation SettingsSandboxPageCreateInstanceMutation(
        $input: CreateSandboxConfigInstanceInput!
      ) {
        createSandboxConfigInstance(input: $input) {
          id
          backendType
          name
          description
          config
          timeout
          enabled
          configHash
        }
      }
    `);

  const handleCreate = useCallback(() => {
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const config: Record<string, string> = {};
    for (const field of adapter.configFields) {
      const val = configValues[field.key];
      if (val) {
        config[field.key] = val;
      }
    }

    commitCreate({
      variables: {
        input: {
          backendType: adapter.key as SandboxBackendType,
          name: name.trim(),
          description: description.trim() || null,
          config,
          timeout,
        },
      },
      onCompleted: () => onSaved(),
      onError: (err) => setError(err.message),
    });
  }, [
    adapter,
    name,
    description,
    configValues,
    timeout,
    commitCreate,
    onSaved,
  ]);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Config: {adapter.label}</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <TextField value={name} onChange={setName}>
              <Label>Name</Label>
              <Input placeholder="e.g. production, staging" />
            </TextField>
            <TextField value={description} onChange={setDescription}>
              <Label>Description (optional)</Label>
              <TextArea />
            </TextField>
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
            {error != null && (
              <Text size="S" color="danger">
                {error}
              </Text>
            )}
            <Flex direction="row" gap="size-100">
              <Button
                variant="primary"
                isDisabled={isCreating}
                onPress={handleCreate}
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </Flex>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}

function EditInstanceDialog({
  adapter,
  instance,
  onSaved,
}: {
  adapter: AdapterInfo;
  instance: ConfigInstanceInfo;
  onSaved: () => void;
}) {
  const instanceConfig =
    (instance.config as Record<string, string> | null) ?? {};
  const [name, setName] = useState(instance.name);
  const [description, setDescription] = useState(instance.description ?? "");
  const [configValues, setConfigValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      adapter.configFields.map((f) => [f.key, instanceConfig[f.key] ?? ""])
    )
  );
  const [timeout, setTimeout] = useState(instance.timeout);
  const [enabled, setEnabled] = useState(instance.enabled);
  const [error, setError] = useState<string | null>(null);

  const [commitUpdate, isUpdating] =
    useMutation<SettingsSandboxPageUpdateInstanceMutation>(graphql`
      mutation SettingsSandboxPageUpdateInstanceMutation(
        $input: UpdateSandboxConfigInstanceInput!
      ) {
        updateSandboxConfigInstance(input: $input) {
          id
          backendType
          name
          description
          config
          timeout
          enabled
          configHash
        }
      }
    `);

  const [commitDelete, isDeleting] =
    useMutation<SettingsSandboxPageDeleteInstanceMutation>(graphql`
      mutation SettingsSandboxPageDeleteInstanceMutation($id: ID!) {
        deleteSandboxConfigInstance(id: $id) {
          id
        }
      }
    `);

  const isBusy = isUpdating || isDeleting;

  const handleSave = useCallback(() => {
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const config: Record<string, string> = {};
    for (const field of adapter.configFields) {
      const val = configValues[field.key];
      if (val) {
        config[field.key] = val;
      }
    }

    commitUpdate({
      variables: {
        input: {
          id: instance.id,
          name: name.trim(),
          description: description.trim() || null,
          config,
          timeout,
          enabled,
        },
      },
      onCompleted: () => onSaved(),
      onError: (err) => setError(err.message),
    });
  }, [
    adapter,
    instance,
    name,
    description,
    configValues,
    timeout,
    enabled,
    commitUpdate,
    onSaved,
  ]);

  const handleDelete = useCallback(() => {
    setError(null);
    commitDelete({
      variables: { id: instance.id },
      onCompleted: () => onSaved(),
      onError: (err) => setError(err.message),
    });
  }, [instance, commitDelete, onSaved]);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit Config: {instance.name} ({adapter.label})
          </DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <TextField value={name} onChange={setName}>
              <Label>Name</Label>
              <Input />
            </TextField>
            <TextField value={description} onChange={setDescription}>
              <Label>Description (optional)</Label>
              <TextArea />
            </TextField>
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
            <Flex direction="row" alignItems="center" gap="size-100">
              <Switch
                isSelected={enabled}
                onChange={setEnabled}
                aria-label="Enable config instance"
              >
                {null}
              </Switch>
              <Text size="S" color={enabled ? "text-700" : "text-300"}>
                {enabled ? "Enabled" : "Disabled"}
              </Text>
            </Flex>
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
                {isUpdating ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="default"
                isDisabled={isBusy}
                onPress={handleDelete}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </Flex>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}
