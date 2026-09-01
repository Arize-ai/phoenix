import { css } from "@emotion/react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Flex,
  Form,
  LinkButton,
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
  settingsRowsCSS,
  SettingsSwitchRow,
  SystemBadge,
} from "./SettingsAgentsShared";

const linkRowCSS = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-150);

  .assistant-settings-row__label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }
`;

const settingValueCSS = css`
  padding: 0 var(--global-dimension-size-150) var(--global-dimension-size-150);
`;

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

  return (
    <div css={settingValueCSS}>
      <Form>
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
                Remove workspace token
              </Button>
            ) : null}
            <Button
              size="S"
              variant={isDirty ? "primary" : "default"}
              onPress={() =>
                handleSubmit(({ token }) => commitToken(token.trim()))()
              }
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
  const store = useAgentStore();
  const notifyError = useNotifyError();

  const [setAgentGithubEnabled, isUpdatingGithubEnabled] =
    useMutation<SettingsAgentsToolsTabSetAgentGithubEnabledMutation>(graphql`
      mutation SettingsAgentsToolsTabSetAgentGithubEnabledMutation(
        $input: SetAgentGithubEnabledInput!
      ) {
        setAgentGithubEnabled(input: $input) {
          enabled
        }
      }
    `);

  const handleGithubEnabledChange = (next: boolean) => {
    setAgentGithubEnabled({
      variables: { input: { enabled: next } },
      onCompleted: (response) => {
        store.getState().setAgentsConfig({
          // The env ceiling is already known true here — the row only renders
          // when githubServerEnabled — so the DB setting is the effective state.
          githubEnabled: response.setAgentGithubEnabled.enabled,
        });
      },
      onError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to update GitHub tools",
          message: messages?.[0] ?? error.message,
        });
      },
    });
  };

  return (
    <li>
      <SettingsSwitchRow
        title="GitHub tools"
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
  if (!githubServerEnabled) {
    return null;
  }
  return (
    <SettingsAgentsSection
      title="Connections"
      description="Credentials the assistant uses to act on external services as you."
    >
      <ul css={isAdmin ? groupedSettingsRowsCSS : settingsRowsCSS}>
        {isAdmin ? <GithubToolsSystemSetting /> : null}
        <AgentGitHubSettings />
      </ul>
    </SettingsAgentsSection>
  );
}

/**
 * Tools tab: what the assistant is allowed to do (capabilities), the
 * credentials it acts with (connections), and where workspace-wide tool
 * sources like MCP servers are managed.
 */
export function SettingsAgentsToolsTab() {
  return (
    <Flex direction="column" gap="size-300">
      <SettingsAgentsSection
        title="Capabilities"
        description="What the assistant is allowed to do while working on your behalf."
      >
        <Flex direction="column" gap="size-150">
          <AgentWebAccessSettings />
          {isServerAgentRuntimeEnabled(window.Config.agentBashDisabled) ? (
            <AgentSubagentsSettings />
          ) : null}
        </Flex>
      </SettingsAgentsSection>
      <ConnectionsSection />
      <SettingsAgentsSection
        title="MCP servers"
        description="Tools from Model Context Protocol servers are configured once for the whole workspace."
      >
        <ul css={settingsRowsCSS}>
          <li>
            <div css={linkRowCSS}>
              <span className="assistant-settings-row__label">
                <Text weight="heavy">MCP servers</Text>
                <Text color="text-500" size="S">
                  Tools exposed by connected MCP servers are available to the
                  assistant in every chat.
                </Text>
              </span>
              <LinkButton size="S" to="/settings/mcp">
                Manage MCP servers
              </LinkButton>
            </div>
          </li>
        </ul>
      </SettingsAgentsSection>
    </Flex>
  );
}
