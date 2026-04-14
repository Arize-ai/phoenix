import { Suspense, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Button,
  ComboBox,
  ComboBoxItem,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  FieldError,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  Modal,
  ModalOverlay,
  NumberField,
  Radio,
  RadioGroup,
  Switch,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SandboxConfigDialogCreateSandboxConfigMutation } from "./__generated__/SandboxConfigDialogCreateSandboxConfigMutation.graphql";
import type { SandboxConfigDialogSecretsQuery } from "./__generated__/SandboxConfigDialogSecretsQuery.graphql";
import type { SandboxConfigDialogUpdateSandboxConfigMutation } from "./__generated__/SandboxConfigDialogUpdateSandboxConfigMutation.graphql";
import type {
  BackendInfo,
  EnvVarFormEntry,
  ProviderRow,
  SandboxConfig,
  SandboxConfigFormValues,
  SandboxProvider,
} from "./types";
import { languageLabel, parseConfigText, toPrettyJSONObject } from "./utils";

type SandboxConfigDialogTriggerProps =
  | { mode: "create"; providers: ProviderRow[]; defaultProvider?: ProviderRow }
  | {
      mode: "edit";
      provider: SandboxProvider;
      backend: BackendInfo;
      config: SandboxConfig;
    };

export function SandboxConfigDialogTrigger(
  props: SandboxConfigDialogTriggerProps
) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {props.mode === "create" ? (
        <Button
          size="S"
          variant="primary"
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        >
          New Sandbox
        </Button>
      ) : (
        <Button
          size="S"
          aria-label={`Edit ${props.config.name}`}
          leadingVisual={<Icon svg={<Icons.EditOutline />} />}
        />
      )}
      <ModalOverlay>
        <Modal size="L">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {props.mode === "create"
                    ? "New Sandbox Config"
                    : `Edit "${props.config.name}" config`}
                </DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              {props.mode === "create" ? (
                <SandboxConfigDialogContent
                  mode="create"
                  providers={props.providers}
                  defaultProvider={props.defaultProvider}
                  onClose={() => setIsOpen(false)}
                />
              ) : (
                <SandboxConfigDialogContent
                  mode="edit"
                  provider={props.provider}
                  backend={props.backend}
                  config={props.config}
                  onClose={() => setIsOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

type SandboxConfigDialogContentProps = (
  | { mode: "create"; providers: ProviderRow[]; defaultProvider?: ProviderRow }
  | {
      mode: "edit";
      provider: SandboxProvider;
      backend: BackendInfo;
      config: SandboxConfig;
    }
) & { onClose: () => void };

function defaultConfigName(provider: ProviderRow): string {
  return `${provider.backend.displayName}`;
}

function configToFormValues(config: SandboxConfig["config"]): {
  envVars: EnvVarFormEntry[];
  internetAccessEnabled: boolean;
  dependenciesText: string;
} {
  const raw = (config as Record<string, unknown>) ?? {};
  const rawEnvVars = Array.isArray(raw["env_vars"]) ? raw["env_vars"] : [];
  const envVars: EnvVarFormEntry[] = rawEnvVars.map((entry: unknown) => {
    if (
      entry != null &&
      typeof entry === "object" &&
      "kind" in entry &&
      (entry as Record<string, unknown>)["kind"] === "secret_ref"
    ) {
      const e = entry as Record<string, unknown>;
      return {
        kind: "secret_ref" as const,
        name: String(e["name"] ?? ""),
        secret_key: String(e["secret_key"] ?? ""),
      };
    }
    const e = (entry ?? {}) as Record<string, unknown>;
    return {
      kind: "literal" as const,
      name: String(e["name"] ?? ""),
      value: String(e["value"] ?? ""),
    };
  });

  const internetAccess = raw["internet_access"] as
    | Record<string, unknown>
    | undefined;
  const internetAccessEnabled = internetAccess?.["mode"] === "allow";

  const deps = raw["dependencies"] as Record<string, unknown> | undefined;
  const packages = Array.isArray(deps?.["packages"])
    ? (deps!["packages"] as string[]).join("\n")
    : "";

  return { envVars, internetAccessEnabled, dependenciesText: packages };
}

function formValuesToConfigPatch(
  values: SandboxConfigFormValues,
  backend: BackendInfo | undefined
): Record<string, unknown> {
  const base = parseConfigText(values.configText).config ?? {};

  if (backend?.supportsEnvVars && values.envVars.length > 0) {
    base["env_vars"] = values.envVars.map((entry) => {
      if (entry.kind === "secret_ref") {
        return {
          kind: "secret_ref",
          name: entry.name,
          secret_key: entry.secret_key,
        };
      }
      return { kind: "literal", name: entry.name, value: entry.value };
    });
  } else {
    delete base["env_vars"];
  }

  if (backend?.internetAccess === "BOOLEAN") {
    base["internet_access"] = {
      mode: values.internetAccessEnabled ? "allow" : "deny",
    };
  } else {
    delete base["internet_access"];
  }

  if (backend?.dependenciesLanguage != null) {
    const packages = values.dependenciesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (packages.length > 0) {
      base["dependencies"] = { packages };
    } else {
      delete base["dependencies"];
    }
  } else {
    delete base["dependencies"];
  }

  return base;
}

function SandboxConfigDialogContent(props: SandboxConfigDialogContentProps) {
  const { mode, onClose } = props;
  const providers = mode === "create" ? props.providers : [];
  const defaultProvider = mode === "create" ? props.defaultProvider : undefined;
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);

  const existingBackend = mode === "edit" ? props.backend : undefined;
  const existingConfig = mode === "edit" ? props.config : undefined;
  const {
    envVars: initEnvVars,
    internetAccessEnabled: initInternetAccess,
    dependenciesText: initDepsText,
  } = existingConfig != null
    ? configToFormValues(existingConfig.config)
    : { envVars: [], internetAccessEnabled: false, dependenciesText: "" };

  const form = useForm<SandboxConfigFormValues>({
    defaultValues:
      mode === "edit"
        ? {
            sandboxProviderId: props.provider.id,
            name: props.config.name,
            description: props.config.description ?? "",
            timeout: props.config.timeout,
            configText: toPrettyJSONObject(
              (() => {
                const raw = {
                  ...((props.config.config as Record<string, unknown>) ?? {}),
                };
                delete raw["env_vars"];
                delete raw["internet_access"];
                delete raw["dependencies"];
                return raw;
              })()
            ),
            envVars: initEnvVars,
            internetAccessEnabled: initInternetAccess,
            dependenciesText: initDepsText,
          }
        : {
            sandboxProviderId: defaultProvider?.provider.id ?? "",
            name: defaultProvider ? defaultConfigName(defaultProvider) : "",
            description: "",
            timeout: 30,
            configText: toPrettyJSONObject({}),
            envVars: [],
            internetAccessEnabled: false,
            dependenciesText: "",
          },
  });

  const {
    fields: envVarFields,
    append: appendEnvVar,
    remove: removeEnvVar,
  } = useFieldArray({ control: form.control, name: "envVars" });

  const selectedProviderId = useWatch({
    control: form.control,
    name: "sandboxProviderId",
  });
  const activeBackend: BackendInfo | undefined =
    mode === "edit"
      ? existingBackend
      : providers.find((p) => p.provider.id === selectedProviderId)?.backend;

  const [commitCreate, isCreating] =
    useMutation<SandboxConfigDialogCreateSandboxConfigMutation>(graphql`
      mutation SandboxConfigDialogCreateSandboxConfigMutation(
        $input: CreateSandboxConfigInput!
      ) {
        createSandboxConfig(input: $input) {
          query {
            ...SettingsSandboxesPageFragment
          }
        }
      }
    `);
  const [commitUpdate, isUpdating] =
    useMutation<SandboxConfigDialogUpdateSandboxConfigMutation>(graphql`
      mutation SandboxConfigDialogUpdateSandboxConfigMutation(
        $input: UpdateSandboxConfigInput!
      ) {
        updateSandboxConfig(input: $input) {
          query {
            ...SettingsSandboxesPageFragment
          }
        }
      }
    `);

  const isSubmitting = isCreating || isUpdating;

  const handleSubmit = form.handleSubmit((values) => {
    setError(null);
    const parsedConfig = parseConfigText(values.configText);
    if (parsedConfig.error) {
      setError(parsedConfig.error);
      return;
    }

    const finalConfig = formValuesToConfigPatch(values, activeBackend);

    const onCompleted = () => {
      onClose();
      notifySuccess({
        title: mode === "create" ? "Config created" : "Config updated",
        message:
          mode === "create"
            ? `${values.name} is ready to use.`
            : `${props.config.name} was updated.`,
      });
    };
    const onError = (mutationError: Error) => {
      setError(
        getErrorMessagesFromRelayMutationError(mutationError)?.[0] ??
          `Failed to ${mode} sandbox config`
      );
    };

    if (mode === "create") {
      commitCreate({
        variables: {
          input: {
            sandboxProviderId: values.sandboxProviderId,
            name: values.name,
            description: values.description || null,
            timeout: values.timeout,
            config: finalConfig,
          },
        },
        onCompleted,
        onError,
      });
      return;
    }

    commitUpdate({
      variables: {
        input: {
          id: props.config.id,
          description: values.description || null,
          timeout: values.timeout,
          config: finalConfig,
        },
      },
      onCompleted,
      onError,
    });
  });

  return (
    <>
      {error ? (
        <Alert variant="danger" banner>
          {error}
        </Alert>
      ) : null}
      <form onSubmit={handleSubmit}>
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            {mode === "create" ? (
              <Controller
                name="sandboxProviderId"
                control={form.control}
                rules={{ required: "Provider is required" }}
                render={({ field, fieldState }) => (
                  <ComboBox
                    label="Provider"
                    placeholder="Search providers"
                    size="L"
                    selectedKey={field.value || null}
                    onSelectionChange={(key) => {
                      if (typeof key === "string") {
                        field.onChange(key);
                        const currentName = form.getValues("name");
                        const isDefaultName =
                          !currentName ||
                          providers.some(
                            (p) => defaultConfigName(p) === currentName
                          );
                        if (isDefaultName) {
                          const selected = providers.find(
                            (p) => p.provider.id === key
                          );
                          if (selected) {
                            form.setValue("name", defaultConfigName(selected));
                          }
                        }
                      }
                    }}
                    onBlur={field.onBlur}
                    isInvalid={fieldState.invalid}
                    errorMessage={fieldState.error?.message}
                    menuTrigger="focus"
                    defaultItems={providers ?? []}
                    renderEmptyState={() => <div>No providers found</div>}
                  >
                    {(item) => (
                      <ComboBoxItem
                        id={item.provider.id}
                        key={item.provider.id}
                        textValue={`${item.backend.displayName}`}
                      >
                        <Flex direction="column" gap="size-25">
                          <Text>{item.backend.displayName}</Text>
                          <Text color="text-700" size="S">
                            {languageLabel(item.provider.language)} provider
                          </Text>
                        </Flex>
                      </ComboBoxItem>
                    )}
                  </ComboBox>
                )}
              />
            ) : null}
            {mode === "create" && (
              <Controller
                name="name"
                control={form.control}
                rules={{
                  required: mode === "create" ? "Name is required" : false,
                }}
                render={({ field, fieldState }) => (
                  <TextField {...field} isInvalid={fieldState.invalid}>
                    <Label>Name</Label>
                    <Input />
                    {fieldState.error ? (
                      <FieldError>{fieldState.error.message}</FieldError>
                    ) : null}
                  </TextField>
                )}
              />
            )}
            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <TextField {...field}>
                  <Label>Description</Label>
                  <TextArea placeholder="Optional description" />
                </TextField>
              )}
            />
            <Controller
              name="timeout"
              control={form.control}
              rules={{
                required: "Timeout is required",
                min: { value: 1, message: "Timeout must be at least 1 second" },
              }}
              render={({ field, fieldState }) => (
                <NumberField
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  step={1}
                  isInvalid={fieldState.invalid}
                >
                  <Label>Timeout (seconds)</Label>
                  <Input />
                  {fieldState.error ? (
                    <FieldError>{fieldState.error.message}</FieldError>
                  ) : null}
                </NumberField>
              )}
            />
            {activeBackend?.supportsEnvVars ? (
              <Flex direction="column" gap="size-100">
                <Flex justifyContent="space-between" alignItems="center">
                  <Label>Environment Variables</Label>
                  <Button
                    size="S"
                    variant="default"
                    leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
                    onPress={() =>
                      appendEnvVar({ kind: "literal", name: "", value: "" })
                    }
                  >
                    Add Variable
                  </Button>
                </Flex>
                {envVarFields.length === 0 ? (
                  <Text color="text-700" size="S">
                    No environment variables configured.
                  </Text>
                ) : (
                  envVarFields.map((fieldItem, index) => (
                    <EnvVarRow
                      key={fieldItem.id}
                      index={index}
                      form={form}
                      onRemove={() => removeEnvVar(index)}
                    />
                  ))
                )}
              </Flex>
            ) : null}
            {activeBackend?.internetAccess === "BOOLEAN" ? (
              <Controller
                name="internetAccessEnabled"
                control={form.control}
                render={({ field }) => (
                  <Switch isSelected={field.value} onChange={field.onChange}>
                    <Label>Allow Internet Access</Label>
                  </Switch>
                )}
              />
            ) : null}
            {activeBackend?.dependenciesLanguage != null ? (
              <Controller
                name="dependenciesText"
                control={form.control}
                render={({ field }) => (
                  <TextField {...field}>
                    <Label>
                      {activeBackend.dependenciesLanguage === "PYTHON"
                        ? "Python Packages"
                        : "npm Packages"}
                    </Label>
                    <TextArea
                      placeholder={
                        activeBackend.dependenciesLanguage === "PYTHON"
                          ? "requests\nnumpy==1.26.0"
                          : "@types/node\nlodash"
                      }
                    />
                    <Text slot="description" size="S" color="text-700">
                      One package per line. Installed before code execution.
                    </Text>
                  </TextField>
                )}
              />
            ) : null}
            <Controller
              name="configText"
              control={form.control}
              rules={{
                validate: (value) => parseConfigText(value).error ?? true,
              }}
              render={({ field, fieldState }) => (
                <CodeEditorFieldWrapper
                  label="Advanced Config JSON"
                  errorMessage={fieldState.error?.message}
                  description="Use this for backend-specific settings like templates, credentials, or runtime options."
                >
                  <JSONEditor
                    value={field.value}
                    onChange={field.onChange}
                    optionalLint
                  />
                </CodeEditorFieldWrapper>
              )}
            />
          </Flex>
        </View>
        <DialogFooter>
          <Button variant="default" onPress={onClose} size="S">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isDisabled={isSubmitting}
            size="S"
          >
            {mode === "create" ? "Create Config" : "Save Changes"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function EnvVarRow({
  index,
  form,
  onRemove,
}: {
  index: number;
  form: ReturnType<typeof useForm<SandboxConfigFormValues>>;
  onRemove: () => void;
}) {
  const kind = useWatch({
    control: form.control,
    name: `envVars.${index}.kind`,
  });

  return (
    <Flex gap="size-100" alignItems="start">
      <Controller
        name={`envVars.${index}.kind`}
        control={form.control}
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onChange={(val) => {
              field.onChange(val);
              if (val === "secret_ref") {
                form.setValue(`envVars.${index}.value`, "");
              } else {
                form.setValue(`envVars.${index}.secret_key`, "");
              }
            }}
            orientation="horizontal"
          >
            <Radio value="literal">Value</Radio>
            <Radio value="secret_ref">Secret</Radio>
          </RadioGroup>
        )}
      />
      <Controller
        name={`envVars.${index}.name`}
        control={form.control}
        rules={{ required: "Name is required" }}
        render={({ field, fieldState }) => (
          <TextField {...field} isInvalid={fieldState.invalid}>
            <Label>Name</Label>
            <Input placeholder="MY_VAR" />
            {fieldState.error ? (
              <FieldError>{fieldState.error.message}</FieldError>
            ) : null}
          </TextField>
        )}
      />
      {kind === "secret_ref" ? (
        <Suspense
          fallback={<SecretKeyInputFallback index={index} form={form} />}
        >
          <SecretKeyComboBox index={index} form={form} />
        </Suspense>
      ) : (
        <Controller
          name={`envVars.${index}.value`}
          control={form.control}
          render={({ field }) => (
            <TextField {...field}>
              <Label>Value</Label>
              <Input placeholder="value" />
            </TextField>
          )}
        />
      )}
      <Button
        size="S"
        variant="danger"
        aria-label="Remove variable"
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
        onPress={onRemove}
      />
    </Flex>
  );
}

function SecretKeyInputFallback({
  index,
  form,
}: {
  index: number;
  form: ReturnType<typeof useForm<SandboxConfigFormValues>>;
}) {
  return (
    <Controller
      name={`envVars.${index}.secret_key`}
      control={form.control}
      render={({ field }) => (
        <TextField {...field}>
          <Label>Secret Key</Label>
          <Input placeholder="Loading..." />
        </TextField>
      )}
    />
  );
}

function SecretKeyComboBox({
  index,
  form,
}: {
  index: number;
  form: ReturnType<typeof useForm<SandboxConfigFormValues>>;
}) {
  const data = useLazyLoadQuery<SandboxConfigDialogSecretsQuery>(
    graphql`
      query SandboxConfigDialogSecretsQuery {
        secrets(first: 200) {
          edges {
            node {
              key
            }
          }
        }
      }
    `,
    {}
  );

  const secretKeys = data.secrets.edges.map((e) => ({
    id: e.node.key,
    key: e.node.key,
  }));

  return (
    <Controller
      name={`envVars.${index}.secret_key`}
      control={form.control}
      rules={{ required: "Secret key is required" }}
      render={({ field, fieldState }) => (
        <ComboBox
          label="Secret Key"
          placeholder="Select a secret"
          size="M"
          selectedKey={field.value || null}
          onSelectionChange={(key) => {
            if (typeof key === "string") field.onChange(key);
          }}
          onBlur={field.onBlur}
          isInvalid={fieldState.invalid}
          errorMessage={fieldState.error?.message}
          menuTrigger="focus"
          defaultItems={secretKeys}
          renderEmptyState={() => <div>No secrets found</div>}
        >
          {(item) => (
            <ComboBoxItem id={item.id} key={item.id} textValue={item.key}>
              {item.key}
            </ComboBoxItem>
          )}
        </ComboBox>
      )}
    />
  );
}
