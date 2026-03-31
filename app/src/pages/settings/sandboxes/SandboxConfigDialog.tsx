import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

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
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SandboxConfigDialogCreateSandboxConfigMutation } from "./__generated__/SandboxConfigDialogCreateSandboxConfigMutation.graphql";
import type { SandboxConfigDialogUpdateSandboxConfigMutation } from "./__generated__/SandboxConfigDialogUpdateSandboxConfigMutation.graphql";
import type {
  ProviderRow,
  SandboxConfig,
  SandboxConfigFormValues,
  SandboxProvider,
} from "./types";
import { languageLabel, parseConfigText, toPrettyJSONObject } from "./utils";

export function SandboxConfigDialogTrigger({
  mode,
  provider,
  providers,
  config,
}: {
  mode: "create" | "edit";
  provider?: SandboxProvider;
  providers?: ProviderRow[];
  config?: SandboxConfig;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {mode === "create" ? (
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
          aria-label={`Edit ${config?.name}`}
          leadingVisual={<Icon svg={<Icons.EditOutline />} />}
        />
      )}
      <ModalOverlay>
        <Modal size="L">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {mode === "create"
                    ? "New Sandbox Config"
                    : `Edit "${config?.name}" config`}
                </DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <SandboxConfigDialogContent
                mode={mode}
                provider={provider}
                providers={providers}
                config={config}
                onClose={() => setIsOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

function SandboxConfigDialogContent({
  mode,
  provider,
  providers,
  config,
  onClose,
}: {
  mode: "create" | "edit";
  provider?: SandboxProvider;
  providers?: ProviderRow[];
  config?: SandboxConfig;
  onClose: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SandboxConfigFormValues>({
    defaultValues: {
      sandboxProviderId: provider?.id ?? "",
      name: config?.name ?? "",
      description: config?.description ?? "",
      timeout: config?.timeout ?? 30,
      enabled: config?.enabled ?? true,
      configText: toPrettyJSONObject(config?.config ?? {}),
    },
  });
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

    const onCompleted = () => {
      onClose();
      notifySuccess({
        title: mode === "create" ? "Config created" : "Config updated",
        message:
          mode === "create"
            ? `${values.name} is ready to use.`
            : `${config?.name ?? values.name} was updated.`,
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
            enabled: values.enabled,
            config: parsedConfig.config,
          },
        },
        onCompleted,
        onError,
      });
      return;
    }

    if (!config) {
      setError("Config details are missing");
      return;
    }

    commitUpdate({
      variables: {
        input: {
          id: config.id,
          description: values.description || null,
          timeout: values.timeout,
          enabled: values.enabled,
          config: parsedConfig.config,
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
                    selectedKey={field.value || null}
                    onSelectionChange={(key) => {
                      if (typeof key === "string") {
                        field.onChange(key);
                      }
                    }}
                    onBlur={field.onBlur}
                    isInvalid={fieldState.invalid}
                    errorMessage={fieldState.error?.message}
                    size="M"
                    menuTrigger="focus"
                    defaultItems={providers ?? []}
                    renderEmptyState={() => <div>No providers found</div>}
                  >
                    {(item) => (
                      <ComboBoxItem
                        id={item.provider.id}
                        key={item.provider.id}
                        textValue={`${item.backend.displayName} ${languageLabel(item.provider.language)}`}
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
