import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Card,
  ContextualHelp,
  DialogTrigger,
  DocumentationHelp,
  Flex,
  Icon,
  Icons,
  Label,
  Modal,
  ModalOverlay,
  Switch,
  Text,
} from "@phoenix/components";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SandboxProvidersCardProviderEnabledSwitchMutation } from "./__generated__/SandboxProvidersCardProviderEnabledSwitchMutation.graphql";
import { SandboxProviderCredentialsDialog } from "./SandboxProviderCredentialsDialog";
import { sandboxesTableCSS } from "./styles";
import type { BackendInfo, ProviderRow, SandboxProvider } from "./types";
import {
  getBackendDescription,
  LanguageWithIcon,
  SandboxHostingTypeBadge,
  StatusText,
} from "./utils";

export function SandboxProvidersCard({
  providers,
  onRefresh,
}: {
  providers: ProviderRow[];
  onRefresh: () => void;
}) {
  return (
    <Card
      title="Sandbox Providers"
      titleExtra={
        <DocumentationHelp topic="sandboxProviders">
          Shared provider settings and whether each sandbox runtime can be
          enabled.
        </DocumentationHelp>
      }
    >
      <table css={sandboxesTableCSS}>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Languages</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {providers.map(({ backend, provider }) => {
            const canEnable = backend.status === "AVAILABLE";
            return (
              <tr key={provider.id}>
                <td>
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <SandboxProviderIcon
                      backendType={backend.backendType}
                      height={18}
                    />
                    <span>{backend.displayName}</span>
                    <SandboxHostingTypeBadge
                      hostingType={backend.hostingType}
                    />
                    <ContextualHelp variant="info">
                      {getBackendDescription(backend.backendType)}
                    </ContextualHelp>
                  </Flex>
                </td>
                <td>
                  <Flex direction="row" gap="size-300">
                    {[...provider.supportedLanguages].map((lang) => (
                      <LanguageWithIcon key={lang} language={lang} />
                    ))}
                  </Flex>
                </td>
                <td>
                  {canEnable ? (
                    <ProviderEnabledSwitch
                      provider={provider}
                      canEnable={canEnable}
                    />
                  ) : (
                    <StatusText
                      status={backend.status}
                      detail={backend.statusDetail}
                      dependencyHints={backend.dependencyHints}
                    />
                  )}
                </td>
                <td>
                  <Flex justifyContent="end">
                    <ConfigureCredentialsButton
                      backend={backend}
                      onRefresh={onRefresh}
                    />
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

function ConfigureCredentialsButton({
  backend,
  onRefresh,
}: {
  backend: BackendInfo;
  onRefresh: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasCredentialSpecs = backend.credentialSpecs.length > 0;
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        size="S"
        aria-label={
          hasCredentialSpecs
            ? `Configure ${backend.displayName} credentials`
            : `${backend.displayName} requires no credentials`
        }
        isDisabled={!hasCredentialSpecs}
        leadingVisual={<Icon svg={<Icons.Settings />} />}
      />
      <ModalOverlay>
        <Modal size="M">
          <SandboxProviderCredentialsDialog
            backend={backend}
            onClose={() => setIsOpen(false)}
            onRefresh={onRefresh}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
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
