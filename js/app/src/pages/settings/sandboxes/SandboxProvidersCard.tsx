import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Card,
  ContextualHelp,
  DocumentationHelp,
  Flex,
  Icon,
  Icons,
  Label,
  ViewportModal,
  ViewportModalOverlay,
  Switch,
  Text,
} from "@phoenix/components";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SandboxProvidersCardProviderEnabledSwitchMutation } from "./__generated__/SandboxProvidersCardProviderEnabledSwitchMutation.graphql";
import { SandboxProviderCredentialsDialog } from "./SandboxProviderCredentialsDialog";
import { sandboxesTableCSS } from "./styles";
import type { ProviderRow, SandboxProvider } from "./types";
import {
  getBackendDescription,
  LanguageWithIcon,
  SandboxHostingTypeBadge,
  SandboxLanguageDialectBadge,
  StatusText,
} from "./utils";

export function SandboxProvidersCard({
  providers,
  onRefresh,
  canManage,
}: {
  providers: ProviderRow[];
  onRefresh: () => void;
  /**
   * Whether the viewer can modify providers. Non-admin members get a
   * read-only view.
   */
  canManage: boolean;
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
          {providers.map(({ backend, provider }) => (
            <SandboxProviderTableRow
              key={provider.id}
              backend={backend}
              provider={provider}
              onRefresh={onRefresh}
              canManage={canManage}
            />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SandboxProviderTableRow({
  backend,
  provider,
  onRefresh,
  canManage,
}: ProviderRow & { onRefresh: () => void; canManage: boolean }) {
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const canEnable = backend.status === "AVAILABLE";
  const canConfigureCredentials =
    canManage && backend.credentialSpecs.length > 0;
  const configureCredentialsLabel = `Configure ${backend.displayName} credentials`;
  const openCredentials = () => setIsCredentialsOpen(true);
  return (
    <tr>
      <td>
        <Flex direction="row" gap="size-100" alignItems="center">
          <SandboxProviderIcon backendType={backend.backendType} height={18} />
          <span>{backend.displayName}</span>
          <SandboxHostingTypeBadge hostingType={backend.hostingType} />
          <SandboxLanguageDialectBadge
            languageDialect={backend.languageDialect}
            runtimeNotes={backend.runtimeNotes}
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
            isReadOnly={!canManage}
          />
        ) : (
          <StatusText
            status={backend.status}
            detail={backend.statusDetail}
            dependencyHints={backend.dependencyHints}
            configureCredentials={
              canConfigureCredentials
                ? {
                    "aria-label": configureCredentialsLabel,
                    onPress: openCredentials,
                  }
                : undefined
            }
          />
        )}
      </td>
      <td>
        {canManage ? (
          <Flex justifyContent="end">
            <Button
              size="S"
              aria-label={
                canConfigureCredentials
                  ? configureCredentialsLabel
                  : `${backend.displayName} requires no credentials`
              }
              isDisabled={!canConfigureCredentials}
              leadingVisual={<Icon svg={<Icons.Settings />} />}
              onPress={openCredentials}
            />
          </Flex>
        ) : null}
        <ViewportModalOverlay
          isOpen={isCredentialsOpen}
          onOpenChange={setIsCredentialsOpen}
        >
          <ViewportModal size="M">
            <SandboxProviderCredentialsDialog
              backend={backend}
              onClose={() => setIsCredentialsOpen(false)}
              onRefresh={onRefresh}
            />
          </ViewportModal>
        </ViewportModalOverlay>
      </td>
    </tr>
  );
}

function ProviderEnabledSwitch({
  provider,
  canEnable,
  isReadOnly,
}: {
  provider: SandboxProvider;
  canEnable: boolean;
  isReadOnly: boolean;
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
        isReadOnly={isReadOnly}
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
