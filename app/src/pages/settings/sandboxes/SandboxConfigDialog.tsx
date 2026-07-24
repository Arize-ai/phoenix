import { css } from "@emotion/react";
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
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  NumberField,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectValue,
  Switch,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { PythonSVG, TypeScriptSVG } from "@phoenix/components/core/icon/Icons";
import {
  SandboxProviderSelect,
  SandboxProviderSelectFallback,
} from "@phoenix/components/sandbox/SandboxProviderSelect";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import {
  getIdentifier,
  transformIdentifierInput,
  validateIdentifier,
} from "@phoenix/utils/identifierUtils";
import { validateDependencyPackages } from "@phoenix/utils/packageSpecUtils";

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
import { DEFAULT_SANDBOX_TIMEOUT_SECONDS } from "./types";
import {
  formValuesToConfigPatch,
  getDependencyPreview,
  shouldShowLocalDenoTrustWarning,
  shouldShowMontySameProcessWarning,
} from "./utils";

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
          leadingVisual={<Icon svg={<Icons.Plus />} />}
        >
          New Sandbox
        </Button>
      ) : (
        <Button
          size="S"
          aria-label={`Edit ${props.config.name}`}
          leadingVisual={<Icon svg={<Icons.Edit />} />}
        />
      )}
      <ModalOverlay>
        <Modal size="M">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {props.mode === "create"
                    ? "New Sandbox Config"
                    : `Edit Sandbox Config: ${props.config.name}`}
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

const NOT_SUPPORTED_COPY = "Not supported by the selected backend.";

// Shared flex sizing for env-var row inputs so the Name and Secret fields
// share remaining space evenly.
const envVarFieldFillCSS = css`
  flex: 1;
  min-width: 0;
`;

// The env-var row controls are top-aligned (see `alignItems="start"` below) so
// a field-level error (e.g. "Name is required") only grows its own column
// downward instead of knocking the rest of the row out of alignment. The
// label-less remove button needs to be nudged down by the height of a field
// label so it lines up with the inputs rather than the labels.
const envVarRemoveButtonOffsetCSS = css`
  padding-top: var(--global-dimension-size-300);
`;

function defaultConfigName(provider: ProviderRow): string {
  return getIdentifier(provider.backend.displayName);
}

export function configToFormValues(config: SandboxConfig["config"]): {
  envVars: EnvVarFormEntry[];
  internetAccessEnabled: boolean;
  dependenciesText: string;
} {
  const envVars: EnvVarFormEntry[] = config.envVars.map((ev) => ({
    name: ev.name,
    secretKey: ev.secretKey,
  }));

  const internetAccessEnabled = config.internetAccess?.mode === "ALLOW";

  const packages = config.dependencies?.packages.join("\n") ?? "";

  return {
    envVars,
    internetAccessEnabled,
    dependenciesText: packages,
  };
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
    : {
        envVars: [],
        internetAccessEnabled: false,
        dependenciesText: "",
      };

  const form = useForm<SandboxConfigFormValues>({
    defaultValues:
      mode === "edit"
        ? {
            sandboxProviderId: props.provider.id,
            // Language is immutable post-create; carry the existing value so
            // form state matches the row but no UI exposes it for editing.
            language: props.config.language,
            name: props.config.name,
            description: props.config.description ?? "",
            timeout: props.config.timeout,
            envVars: initEnvVars,
            internetAccessEnabled: initInternetAccess,
            dependenciesText: initDepsText,
          }
        : {
            sandboxProviderId: defaultProvider?.provider.id ?? "",
            // When the default provider supports exactly one language, prefill
            // it; otherwise leave empty and require the user to pick.
            language:
              defaultProvider?.provider.supportedLanguages.length === 1
                ? defaultProvider.provider.supportedLanguages[0]
                : "",
            name: defaultProvider ? defaultConfigName(defaultProvider) : "",
            description: "",
            timeout: DEFAULT_SANDBOX_TIMEOUT_SECONDS,
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
  const selectedLanguage = useWatch({
    control: form.control,
    name: "language",
  });
  // Effective execution language for adapter capability rendering. Picks from
  // the form's language selector — Daytona / Vercel allow either, single-
  // language adapters auto-fill via the provider-change effect below.
  const dependencyLanguage: "PYTHON" | "TYPESCRIPT" | null =
    selectedLanguage === "PYTHON" || selectedLanguage === "TYPESCRIPT"
      ? selectedLanguage
      : null;

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
    // ``activeBackend`` is null only if no provider is selected. The form's
    // ``required`` rule on ``sandboxProviderId`` makes this unreachable in
    // practice, but guard explicitly so the empty ``@oneOf`` payload that
    // ``formValuesToConfigPatch`` would otherwise produce never reaches the
    // server.
    if (!activeBackend) {
      setError("Provider is required");
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
      if (values.language !== "PYTHON" && values.language !== "TYPESCRIPT") {
        setError("Language is required");
        return;
      }
      commitCreate({
        variables: {
          input: {
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
            {shouldShowLocalDenoTrustWarning(activeBackend) ? (
              <Alert variant="warning">
                Deno runs locally on the Phoenix server and relies on Deno's
                permission system for isolation. Only enable it for trusted code
                execution.
              </Alert>
            ) : null}
            {shouldShowMontySameProcessWarning(activeBackend) ? (
              <Alert variant="warning">
                Monty runs evaluator code inside the Phoenix server process.
                Only use it for trusted code. {activeBackend?.runtimeNotes}
              </Alert>
            ) : null}
            <Suspense fallback={<SandboxProviderSelectFallback />}>
              {mode === "create" ? (
                <Controller
                  name="sandboxProviderId"
                  control={form.control}
                  rules={{ required: "Provider is required" }}
                  render={({ field, fieldState }) => (
                    <SandboxProviderSelect
                      selectedKey={field.value || null}
                      onBlur={field.onBlur}
                      isInvalid={fieldState.invalid}
                      errorMessage={fieldState.error?.message}
                      filter={({ backend, provider }) =>
                        backend.status === "AVAILABLE" && provider.enabled
                      }
                      onChange={(key) => {
                        field.onChange(key);
                        const selected = providers.find(
                          (p) => p.provider.id === key
                        );
                        // Auto-fill language when the chosen provider supports
                        // exactly one; clear it otherwise so the user is forced
                        // to pick in the language selector below.
                        if (selected) {
                          const langs = selected.provider.supportedLanguages;
                          form.setValue(
                            "language",
                            langs.length === 1 ? langs[0] : ""
                          );
                        }
                        // Reset capability-gated fields so values typed under
                        // a prior provider don't silently re-appear when the
                        // user picks a different one. ``formValuesToConfigPatch``
                        // already drops them on send for backends that don't
                        // support a capability, but the form state staying
                        // populated is confusing UX.
                        form.setValue("envVars", []);
                        form.setValue("internetAccessEnabled", false);
                        form.setValue("dependenciesText", "");
                        const currentName = form.getValues("name");
                        const isDefaultName =
                          !currentName ||
                          providers.some(
                            (p) => defaultConfigName(p) === currentName
                          );
                        if (isDefaultName && selected) {
                          form.setValue("name", defaultConfigName(selected));
                        }
                      }}
                    />
                  )}
                />
              ) : (
                <SandboxProviderSelect
                  selectedKey={props.provider.id}
                  isDisabled
                />
              )}
            </Suspense>
            {mode === "create" &&
              (() => {
                const selected = providers.find(
                  (p) => p.provider.id === selectedProviderId
                );
                const langs = selected?.provider.supportedLanguages ?? [];
                // Hide the picker when the chosen provider supports a single
                // language — language is already auto-filled on provider
                // selection. The mutation still sends the language explicitly.
                if (langs.length <= 1) return null;
                return (
                  <Controller
                    name="language"
                    control={form.control}
                    rules={{
                      validate: (v) =>
                        v === "PYTHON" || v === "TYPESCRIPT"
                          ? true
                          : "Language is required",
                    }}
                    render={({ field, fieldState }) => (
                      <Select
                        selectedKey={field.value || null}
                        onSelectionChange={(key) => {
                          if (typeof key === "string") field.onChange(key);
                        }}
                        onBlur={field.onBlur}
                        isInvalid={fieldState.invalid}
                        placeholder="Select a language"
                      >
                        <Label>Language</Label>
                        <Button>
                          <SelectValue />
                          <SelectChevronUpDownIcon />
                        </Button>
                        <Popover>
                          <ListBox>
                            {langs.map((lang) => (
                              <ListBoxItem
                                key={lang}
                                id={lang}
                                textValue={
                                  lang === "PYTHON" ? "Python" : "TypeScript"
                                }
                              >
                                <Flex
                                  direction="row"
                                  gap="size-100"
                                  alignItems="center"
                                >
                                  {lang === "PYTHON" ? (
                                    <PythonSVG />
                                  ) : (
                                    <TypeScriptSVG />
                                  )}
                                  <Text>
                                    {lang === "PYTHON"
                                      ? "Python"
                                      : "TypeScript"}
                                  </Text>
                                </Flex>
                              </ListBoxItem>
                            ))}
                          </ListBox>
                        </Popover>
                        {fieldState.error ? (
                          <FieldError>{fieldState.error.message}</FieldError>
                        ) : null}
                      </Select>
                    )}
                  />
                );
              })()}
            {mode === "edit" && (
              <Select selectedKey={props.config.language} isDisabled>
                <Label>Language</Label>
                <Button>
                  <SelectValue />
                  <SelectChevronUpDownIcon />
                </Button>
                <Popover>
                  <ListBox>
                    <ListBoxItem id="PYTHON" textValue="Python">
                      <Flex direction="row" gap="size-100" alignItems="center">
                        <PythonSVG />
                        <Text>Python</Text>
                      </Flex>
                    </ListBoxItem>
                    <ListBoxItem id="TYPESCRIPT" textValue="TypeScript">
                      <Flex direction="row" gap="size-100" alignItems="center">
                        <TypeScriptSVG />
                        <Text>TypeScript</Text>
                      </Flex>
                    </ListBoxItem>
                  </ListBox>
                </Popover>
              </Select>
            )}
            {mode === "create" && (
              <Controller
                name="name"
                control={form.control}
                rules={{
                  required: "Name is required",
                  validate: validateIdentifier,
                }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    onChange={(value) =>
                      field.onChange(transformIdentifierInput(value))
                    }
                    isInvalid={fieldState.invalid}
                  >
                    <Label>Name</Label>
                    <Input />
                    <Text slot="description" size="S" color="text-700">
                      Lowercase letters, digits, dashes, and underscores. Must
                      start and end with a letter or digit.
                    </Text>
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
                  ) : (
                    <Text slot="description" size="S" color="text-700">
                      Total time allowed for sandbox setup and execution.
                      Defaults to 300s.
                    </Text>
                  )}
                </NumberField>
              )}
            />
            {activeBackend?.supportsEnvVars ? (
              <Flex direction="column" gap="size-100">
                <Text>Environment Variables</Text>
                <Alert variant="warning">
                  Anyone who can run code in this sandbox can read these values
                  (e.g. via <code>os.environ</code>). Don&apos;t store secrets
                  you wouldn&apos;t share with everyone who has access to this
                  config.
                </Alert>
                {envVarFields.length === 0 ? (
                  <Text color="text-700" size="S">
                    No environment variables configured.
                  </Text>
                ) : null}
                {envVarFields.map((fieldItem, index) => (
                  <EnvVarRow
                    key={fieldItem.id}
                    index={index}
                    form={form}
                    onRemove={() => removeEnvVar(index)}
                  />
                ))}
                <Button
                  size="S"
                  variant="default"
                  css={css`
                    width: fit-content;
                  `}
                  leadingVisual={<Icon svg={<Icons.Plus />} />}
                  onPress={() => appendEnvVar({ name: "", secretKey: "" })}
                >
                  Add Variable
                </Button>
              </Flex>
            ) : activeBackend != null ? (
              <Flex direction="column" gap="size-100">
                <Text>Environment Variables</Text>
                <Text color="text-700" size="S">
                  {NOT_SUPPORTED_COPY}
                </Text>
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
            ) : activeBackend != null ? (
              <Flex direction="column" gap="size-100">
                <Text>Internet Access</Text>
                <Text color="text-700" size="S">
                  {NOT_SUPPORTED_COPY}
                </Text>
              </Flex>
            ) : null}
            {activeBackend?.supportsDependencies &&
            dependencyLanguage != null ? (
              <Controller
                name="dependenciesText"
                control={form.control}
                rules={{
                  validate: (value) => {
                    const result = validateDependencyPackages({
                      packagesText: value,
                      language: dependencyLanguage,
                    });
                    return result.valid ? true : result.message;
                  },
                }}
                render={({ field, fieldState }) => {
                  const preview = getDependencyPreview({
                    packagesText: field.value,
                    supportsDependencies: activeBackend.supportsDependencies,
                    language: dependencyLanguage,
                    backendType: activeBackend.backendType,
                  });
                  return (
                    <Flex direction="column" gap="size-50">
                      <TextField {...field} isInvalid={fieldState.invalid}>
                        <Label>
                          {dependencyLanguage === "PYTHON"
                            ? "Python Packages"
                            : "npm Packages"}
                        </Label>
                        <TextArea
                          placeholder={
                            dependencyLanguage === "PYTHON"
                              ? "requests\nnumpy==1.26.0"
                              : "@types/node\nlodash"
                          }
                        />
                        {fieldState.error ? (
                          <FieldError>{fieldState.error.message}</FieldError>
                        ) : (
                          <Text slot="description" size="S" color="text-700">
                            One package per line. Installed before code
                            execution.
                          </Text>
                        )}
                      </TextField>
                      {preview ? (
                        <Text size="S" color="text-700">
                          Preview: <code>{preview}</code>
                        </Text>
                      ) : null}
                    </Flex>
                  );
                }}
              />
            ) : activeBackend != null ? (
              <Flex direction="column" gap="size-100">
                <Text>Dependencies</Text>
                <Text color="text-700" size="S">
                  {NOT_SUPPORTED_COPY}
                </Text>
              </Flex>
            ) : null}
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
  // Track the previously selected secret key so the secret-ref → name
  // auto-populate guard can tell whether the current Name was implicitly
  // taken from the prior secret key (and is therefore safe to overwrite).
  // Initialized once per row from the loaded form value.
  const [previousSecretKey, setPreviousSecretKey] = useState(
    form.getValues(`envVars.${index}.secretKey`) ?? ""
  );

  const nameField = (
    <div css={envVarFieldFillCSS}>
      <Controller
        name={`envVars.${index}.name`}
        control={form.control}
        rules={{ required: "Name is required" }}
        render={({ field, fieldState }) => (
          <TextField {...field} isInvalid={fieldState.invalid}>
            <Label>Variable Name</Label>
            <Input placeholder="MY_VAR" />
            {fieldState.error ? (
              <FieldError>{fieldState.error.message}</FieldError>
            ) : null}
          </TextField>
        )}
      />
    </div>
  );
  const removeButton = (
    <div css={envVarRemoveButtonOffsetCSS}>
      <Button
        size="M"
        variant="quiet"
        aria-label="Remove variable"
        leadingVisual={<Icon svg={<Icons.Trash />} />}
        onPress={onRemove}
      />
    </div>
  );

  const handleSecretKeySelected = (newKey: string) => {
    const currentName = form.getValues(`envVars.${index}.name`) ?? "";
    const shouldAutoPopulate =
      currentName === "" || currentName === previousSecretKey;
    setPreviousSecretKey(newKey);
    if (shouldAutoPopulate) {
      form.setValue(`envVars.${index}.name`, newKey);
    }
  };

  return (
    <Flex gap="size-100" alignItems="start">
      <div css={envVarFieldFillCSS}>
        <Suspense
          fallback={<SecretKeyInputFallback index={index} form={form} />}
        >
          <SecretKeyComboBox
            index={index}
            form={form}
            onSecretKeySelected={handleSecretKeySelected}
          />
        </Suspense>
      </div>
      {nameField}
      {removeButton}
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
      name={`envVars.${index}.secretKey`}
      control={form.control}
      render={({ field }) => (
        <TextField {...field}>
          <Label>Secret</Label>
          <Input placeholder="Loading..." />
        </TextField>
      )}
    />
  );
}

function SecretKeyComboBox({
  index,
  form,
  onSecretKeySelected,
}: {
  index: number;
  form: ReturnType<typeof useForm<SandboxConfigFormValues>>;
  onSecretKeySelected?: (newKey: string) => void;
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
    {},
    // This query is not part of a managed Relay connection, so secrets added
    // elsewhere (e.g. the Secrets settings page mutation) don't get appended to
    // this list in the store. Revalidate against the network on every mount so
    // the combobox always reflects the current set of secrets, while still
    // rendering cached data immediately.
    { fetchPolicy: "store-and-network" }
  );

  const secretKeys = data.secrets.edges.map((e) => ({
    id: e.node.key,
    key: e.node.key,
  }));

  return (
    <Controller
      name={`envVars.${index}.secretKey`}
      control={form.control}
      rules={{ required: "Secret is required" }}
      render={({ field, fieldState }) => (
        <ComboBox
          label="Secret"
          placeholder="Select a secret"
          // Phoenix's ComboBox size scale is offset from TextField's: ComboBox
          // "L" matches TextField "M" (both → --global-input-height-m). Use "L"
          // so this picker visually aligns with the sibling Name TextField.
          size="L"
          selectedKey={field.value || null}
          onSelectionChange={(key) => {
            if (typeof key === "string") {
              field.onChange(key);
              onSecretKeySelected?.(key);
            }
          }}
          onBlur={field.onBlur}
          isInvalid={fieldState.invalid}
          errorMessage={fieldState.error?.message}
          menuTrigger="focus"
          renderEmptyState={() => (
            <View padding="size-150">
              <Flex justifyContent="center" alignItems="center">
                <Text color="gray-300">No secrets found</Text>
              </Flex>
            </View>
          )}
        >
          {secretKeys.map((item) => (
            <ComboBoxItem id={item.id} key={item.id} textValue={item.key}>
              {item.key}
            </ComboBoxItem>
          ))}
        </ComboBox>
      )}
    />
  );
}
