import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Label,
  Modal,
  ModalOverlay,
  RichTooltip,
  Switch,
  Text,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SandboxProvidersCardProviderEnabledSwitchMutation } from "./__generated__/SandboxProvidersCardProviderEnabledSwitchMutation.graphql";
import type { SandboxProvidersCardUpdateSandboxProviderMutation } from "./__generated__/SandboxProvidersCardUpdateSandboxProviderMutation.graphql";
import { cardIntroCSS, sandboxesTableCSS } from "./styles";
import type {
  BackendInfo,
  ProviderRow,
  ProviderSettingsFormValues,
  SandboxProvider,
} from "./types";
import {
  formatTimestamp,
  getBackendDescription,
  hasConfig,
  languageLabel,
  parseConfigText,
  statusLabel,
  summarizeConfig,
  toPrettyJSONObject,
} from "./utils";

export function SandboxProvidersCard({
  providers,
}: {
  providers: ProviderRow[];
}) {
  return (
    <Card title="Sandbox Providers">
      <div css={cardIntroCSS}>
        <Text color="text-700">
          Manage shared provider settings and whether each sandbox runtime can
          be enabled.
        </Text>
      </div>
      <table css={sandboxesTableCSS}>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Runtime</th>
            <th>Status</th>
            <th>Shared Settings</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {providers.map(({ backend, provider }) => {
            const canEnable = backend.status === "AVAILABLE";
            return (
              <tr key={provider.id}>
                <td>
                  <Flex direction="column" gap="size-25">
                    <span>{backend.displayName}</span>
                    <Text color="text-700" size="S">
                      {languageLabel(provider.language)} provider
                    </Text>
                  </Flex>
                </td>
                <td>
                  <Text>{getBackendDescription(backend.backendType)}</Text>
                </td>
                <td>
                  <ProviderStatusText backend={backend} />
                </td>

                <td>
                  <Text
                    color={hasConfig(provider.config) ? undefined : "text-700"}
                  >
                    {hasConfig(provider.config)
                      ? summarizeConfig(provider.config)
                      : "No shared settings"}
                  </Text>
                </td>
                <td>{formatTimestamp(provider.updatedAt)}</td>
                <td>
                  <Flex
                    gap="size-100"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    {canEnable ? (
                      <ProviderEnabledSwitch
                        provider={provider}
                        canEnable={canEnable}
                      />
                    ) : (
                      <Text color="text-700" size="S">
                        Unavailable
                      </Text>
                    )}
                    <Flex justifyContent="end">
                      <EditSandboxProviderButton
                        backend={backend}
                        provider={provider}
                      />
                    </Flex>
                  </Flex>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function ProviderStatusText({ backend }: { backend: BackendInfo }) {
  const label = statusLabel(backend.status);

  if (backend.status === "AVAILABLE") {
    return <Text color="success">{label}</Text>;
  }

  return (
    <TooltipTrigger delay={100}>
      <TriggerWrap>
        <Text color="text-700">{label}</Text>
      </TriggerWrap>
      <RichTooltip width={320}>
        <Flex direction="column" gap="size-50">
          {backend.dependencyHints.map((hint: string) => (
            <Text key={hint}>{hint}</Text>
          ))}
        </Flex>
      </RichTooltip>
    </TooltipTrigger>
  );
}

function ProviderEnabledSwitch({
  provider,
  canEnable,
}: {
  provider: SandboxProvider;
  canEnable: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [commitUpdate, isSubmitting] =
    useMutation<SandboxProvidersCardProviderEnabledSwitchMutation>(graphql`
      mutation SandboxProvidersCardProviderEnabledSwitchMutation(
        $input: UpdateSandboxProviderInput!
      ) {
        updateSandboxProvider(input: $input) {
          query {
            ...SettingsSandboxesPageFragment
          }
        }
      }
    `);

  return (
    <Flex direction="column" gap="size-50">
      <Switch
        isSelected={provider.enabled}
        isDisabled={!canEnable || isSubmitting}
        onChange={(enabled) => {
          setError(null);
          commitUpdate({
            variables: {
              input: {
                id: provider.id,
                enabled,
              },
            },
            onError: (mutationError) => {
              setError(
                getErrorMessagesFromRelayMutationError(mutationError)?.[0] ??
                  "Failed to update provider"
              );
            },
          });
        }}
      >
        <Label>{provider.enabled ? "Enabled" : "Disabled"}</Label>
      </Switch>
      {error ? (
        <Text color="danger" size="S">
          {error}
        </Text>
      ) : null}
    </Flex>
  );
}

export function EditSandboxProviderButton({
  backend,
  provider,
}: {
  backend: BackendInfo;
  provider: SandboxProvider;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button size="S" leadingVisual={<Icon svg={<Icons.EditOutline />} />} />
      <ModalOverlay>
        <Modal size="L">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {backend.displayName} {languageLabel(provider.language)}{" "}
                  Provider
                </DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <ProviderSettingsDialogContent
                provider={provider}
                onClose={() => setIsOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

function ProviderSettingsDialogContent({
  provider,
  onClose,
}: {
  provider: SandboxProvider;
  onClose: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ProviderSettingsFormValues>({
    defaultValues: {
      enabled: provider.enabled,
      configText: toPrettyJSONObject(provider.config),
    },
  });
  const [commitUpdate, isSubmitting] =
    useMutation<SandboxProvidersCardUpdateSandboxProviderMutation>(graphql`
      mutation SandboxProvidersCardUpdateSandboxProviderMutation(
        $input: UpdateSandboxProviderInput!
      ) {
        updateSandboxProvider(input: $input) {
          query {
            ...SettingsSandboxesPageFragment
          }
        }
      }
    `);

  const handleSubmit = form.handleSubmit((values) => {
    setError(null);
    const parsedConfig = parseConfigText(values.configText);
    if (parsedConfig.error) {
      setError(parsedConfig.error);
      return;
    }
    commitUpdate({
      variables: {
        input: {
          id: provider.id,
          enabled: values.enabled,
          config: parsedConfig.config,
        },
      },
      onCompleted: () => {
        onClose();
        notifySuccess({
          title: "Provider updated",
          message: `${languageLabel(provider.language)} provider settings saved.`,
        });
      },
      onError: (mutationError) => {
        setError(
          getErrorMessagesFromRelayMutationError(mutationError)?.[0] ??
            "Failed to update provider settings"
        );
      },
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
            <Controller
              name="configText"
              control={form.control}
              rules={{
                validate: (value) => parseConfigText(value).error ?? true,
              }}
              render={({ field, fieldState }) => (
                <CodeEditorFieldWrapper
                  label="Shared Provider Settings"
                  errorMessage={fieldState.error?.message}
                  description="These settings are shared across every config under this provider."
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
            Save Provider
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
