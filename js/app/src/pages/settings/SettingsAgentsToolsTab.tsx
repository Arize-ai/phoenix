import { Controller, useForm } from "react-hook-form";
import { graphql } from "react-relay";

import {
  Button,
  Flex,
  Form,
  Icons,
  RedactedCredentialField,
  Text,
} from "@phoenix/components";
import {
  AgentGitHubSettings,
  AgentSubagentsSettings,
  AgentWebAccessSettings,
} from "@phoenix/components/agent";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";
import { GITHUB_PAT_CREDENTIAL_KEY } from "@phoenix/store/agentStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SettingsAgentsToolsTabSetAgentGithubEnabledMutation } from "./__generated__/SettingsAgentsToolsTabSetAgentGithubEnabledMutation.graphql";
import { useSecretMutation } from "./secrets/SecretsMutation";
import {
  groupedSettingsRowsCSS,
  isServerAgentRuntimeEnabled,
  SettingsAgentsSection,
  settingsRowBodyCSS,
  settingsRowsCSS,
  SettingsSwitchRow,
  SystemBadge,
  useAgentsConfigMutation,
} from "./SettingsAgentsShared";

/**
 * Workspace-wide GitHub token management. The token is stored encrypted in the
 * server's secret store via the admin secrets mutation and is never read back
 * into the form — only its configured/absent state is shown. It is the
 * fallback identity for users without a personal token.
 */
function AdminGithubWorkspaceTokenSetting() {
  const notifyError = useNotifyError();
  const notifySuccess = useNotifySuccess();
  const store = useAgentStore();
  const githubWorkspaceTokenConfigured = useAgentContext(
    (state) => state.agentsConfig.githubWorkspaceTokenConfigured
  );
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<{ token: string }>({
    defaultValues: { token: "" },
    mode: "onChange",
  });
  const [upsertSecrets, isUpserting] = useSecretMutation();

  const commitToken = (value: string | null) => {
    const isRemoval = value === null;
    upsertSecrets({
      variables: {
        input: { secrets: [{ key: GITHUB_PAT_CREDENTIAL_KEY, value }] },
        connections: [],
      },
      onCompleted: () => {
        store.getState().setAgentsConfig({
          githubWorkspaceTokenConfigured: !isRemoval,
        });
        reset({ token: "" });
        notifySuccess({
          title: isRemoval
            ? "Workspace token removed"
            : "Workspace token saved",
          message: isRemoval
            ? "The shared GitHub token was deleted."
            : "The shared GitHub token is stored encrypted on the server.",
        });
      },
      onError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to update the workspace GitHub token",
          message: messages?.[0] ?? error.message,
        });
      },
    });
  };

  const submitToken = handleSubmit(({ token }) => commitToken(token.trim()));

  return (
    <div css={settingsRowBodyCSS}>
      <Form onSubmit={submitToken}>
        <Flex direction="column" gap="size-100">
          <Text color="text-500" size="S">
            {githubWorkspaceTokenConfigured
              ? "A shared workspace token is configured. Issues filed by users without a personal token are created under its identity. The token is stored encrypted and never displayed; paste a new one below to replace it."
              : "Optional: add a shared workspace token used when a user has not connected a personal token. Use a fine-grained personal access token with Issues read/write access to the repositories issues are filed into. Stored encrypted on the server and never displayed again."}
          </Text>
          <Controller
            name="token"
            control={control}
            rules={{
              validate: (value) => !!value.trim() || "Token is required",
            }}
            render={({
              field: { name, onChange, onBlur, value },
              fieldState: { error },
            }) => (
              <RedactedCredentialField
                label={
                  githubWorkspaceTokenConfigured
                    ? "Replace workspace token"
                    : "Workspace token"
                }
                placeholder="github_pat_..."
                name={name}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                isDisabled={isUpserting}
                errorMessage={error?.message}
              />
            )}
          />
          <Flex direction="row" gap="size-100" justifyContent="end">
            {githubWorkspaceTokenConfigured ? (
              <Button
                size="S"
                variant="danger"
                onPress={() => commitToken(null)}
                isDisabled={isUpserting}
              >
                Remove
              </Button>
            ) : null}
            <Button
              size="S"
              variant={isDirty ? "primary" : "default"}
              onPress={() => submitToken()}
              isDisabled={isUpserting || !isDirty}
            >
              {githubWorkspaceTokenConfigured ? "Replace" : "Save"}
            </Button>
          </Flex>
        </Flex>
      </Form>
    </div>
  );
}

/**
 * System-scoped switch controlling whether the GitHub tools are available to
 * anyone on this Phoenix instance, plus the shared workspace token while the
 * tools are on. Rendered only for admins.
 */
function GithubToolsSystemSetting() {
  const githubEnabled = useAgentContext(
    (state) => state.agentsConfig.githubEnabled
  );

  const [setAgentGithubEnabled, isUpdatingGithubEnabled] =
    useAgentsConfigMutation<SettingsAgentsToolsTabSetAgentGithubEnabledMutation>(
      {
        mutation: graphql`
          mutation SettingsAgentsToolsTabSetAgentGithubEnabledMutation(
            $input: SetAgentGithubEnabledInput!
          ) {
            setAgentGithubEnabled(input: $input) {
              enabled
            }
          }
        `,
        errorTitle: "Failed to update GitHub tools",
        // The env ceiling is already known true here — the row only renders
        // when githubServerEnabled — so the DB setting is the effective state.
        applyResponse: (response) => ({
          githubEnabled: response.setAgentGithubEnabled.enabled,
        }),
      }
    );

  const handleGithubEnabledChange = (next: boolean) => {
    setAgentGithubEnabled({ input: { enabled: next } });
  };

  return (
    <li>
      <SettingsSwitchRow
        title="GitHub tools"
        icon={<Icons.GitHub />}
        titleExtra={<SystemBadge />}
        description="Lets the assistant search and file GitHub issues. Users authenticate with their own personal access token, with an optional shared workspace token as a fallback."
        isSelected={githubEnabled}
        onChange={handleGithubEnabledChange}
        isDisabled={isUpdatingGithubEnabled}
      />
      {githubEnabled ? <AdminGithubWorkspaceTokenSetting /> : null}
    </li>
  );
}

/**
 * Credentials the assistant uses to act on external services as the viewer.
 * For admins, the system-scoped GitHub gate is paired with the personal token
 * card in one grouped card so the gating dependency is visible in place.
 */
function ConnectionsSection() {
  const isAdmin = useIsAdminOrAuthDisabled();
  const githubServerEnabled = useAgentContext(
    (state) => state.agentsConfig.githubServerEnabled
  );
  const hasSavedGithubToken = useAgentContext((state) =>
    Boolean(state.integrationCredentials[GITHUB_PAT_CREDENTIAL_KEY])
  );
  // While the env-level flag is off the section is hidden — unless this
  // browser still holds a saved personal token, which must stay purgeable.
  if (!githubServerEnabled && !hasSavedGithubToken) {
    return null;
  }
  const showSystemSetting = isAdmin && githubServerEnabled;
  return (
    <SettingsAgentsSection
      title="Connections"
      description="Credentials the assistant uses to act on external services as you."
    >
      <ul css={showSystemSetting ? groupedSettingsRowsCSS : settingsRowsCSS}>
        {showSystemSetting ? <GithubToolsSystemSetting /> : null}
        <AgentGitHubSettings />
      </ul>
    </SettingsAgentsSection>
  );
}

/**
 * Tools tab: what the assistant is allowed to do (capabilities) and the
 * credentials it acts with (connections).
 */
export function SettingsAgentsToolsTab() {
  return (
    <Flex direction="column" gap="size-300">
      <SettingsAgentsSection
        title="Capabilities"
        description="What the assistant is allowed to do while working on your behalf."
      >
        <ul css={settingsRowsCSS}>
          <AgentWebAccessSettings />
          {isServerAgentRuntimeEnabled() ? <AgentSubagentsSettings /> : null}
        </ul>
      </SettingsAgentsSection>
      <ConnectionsSection />
    </Flex>
  );
}
