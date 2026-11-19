import { css } from "@emotion/react";
import { Controller, useForm } from "react-hook-form";

import {
  Button,
  CredentialField,
  CredentialInput,
  Flex,
  Form,
  Icon,
  Icons,
  Label,
  Text,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";
import { GITHUB_PAT_CREDENTIAL_KEY } from "@phoenix/store/agentStore";

import { SystemSettingsWarning } from "./SystemSettingsWarning";

const settingBodyCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-150);
`;

type GitHubTokenFormValues = {
  token: string;
};

/**
 * Personal GitHub token settings: lets the user connect their own fine-grained
 * personal access token so PXI files issues as them. The token is stored only
 * in this browser and rides each chat request ephemerally — it is never
 * persisted server-side.
 *
 * Renders a plain `<li>`; the enclosing list decides whether the row is a
 * standalone card or part of a grouped card.
 */
export function AgentGitHubSettings() {
  const isAdmin = useIsAdminOrAuthDisabled();
  const notifySuccess = useNotifySuccess();
  const store = useAgentStore();
  const githubServerEnabled = useAgentContext(
    (state) => state.agentsConfig.githubServerEnabled
  );
  const githubEnabled = useAgentContext(
    (state) => state.agentsConfig.githubEnabled
  );
  const githubWorkspaceTokenConfigured = useAgentContext(
    (state) => state.agentsConfig.githubWorkspaceTokenConfigured
  );
  const savedToken = useAgentContext(
    (state) => state.integrationCredentials[GITHUB_PAT_CREDENTIAL_KEY] ?? ""
  );
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<GitHubTokenFormValues>({
    // `values` both seeds the form and re-baselines the field (and isDirty)
    // whenever the stored token changes, so no manual reset is needed after
    // save or clear.
    values: { token: savedToken },
  });

  // Even while the server-level flag is off, a token saved earlier must stay
  // purgeable — only hide the row entirely when there is nothing to remove.
  if (!githubServerEnabled && !savedToken) {
    return null;
  }

  const onSubmit = (formValues: GitHubTokenFormValues) => {
    const trimmed = formValues.token.trim();
    store.getState().setIntegrationCredential({
      key: GITHUB_PAT_CREDENTIAL_KEY,
      value: trimmed || null,
    });
    notifySuccess({
      title: trimmed ? "GitHub token saved" : "GitHub token removed",
      message: trimmed
        ? "Your personal access token is stored in this browser."
        : "Your personal access token was removed from this browser.",
    });
  };

  return (
    <li>
      <div css={settingBodyCSS}>
        <Flex direction="column" gap="size-75">
          <Flex direction="row" alignItems="center" gap="size-100">
            <Icon svg={<Icons.GitHub />} />
            <Text weight="heavy" size="M">
              Personal GitHub token
            </Text>
          </Flex>
          <Text color="text-500">
            Connect a fine-grained personal access token with Issues read/write
            access so the assistant can search and file GitHub issues as you.
            Stored only in this browser and never saved on the server.
            {githubWorkspaceTokenConfigured
              ? " Without a personal token, the workspace's shared token is used instead."
              : ""}
          </Text>
          <Text color="text-500" size="S">
            {savedToken
              ? "A token is saved in this browser."
              : "No token saved in this browser."}
          </Text>
        </Flex>
        {githubServerEnabled ? (
          <Form onSubmit={handleSubmit(onSubmit)}>
            <Flex direction="column" gap="size-100">
              <Controller
                name="token"
                control={control}
                render={({ field: { name, onChange, onBlur, value } }) => (
                  <CredentialField
                    name={name}
                    value={value ?? ""}
                    onChange={onChange}
                    onBlur={onBlur}
                    isDisabled={!githubEnabled}
                  >
                    <Label>Personal access token</Label>
                    <CredentialInput placeholder="github_pat_..." />
                  </CredentialField>
                )}
              />
              <Flex direction="row" gap="size-100" justifyContent="end">
                {savedToken ? (
                  // Removal only clears this browser's local storage, so it
                  // stays available even while the admin toggle is off — a user
                  // must always be able to purge their own stored token.
                  <Button
                    size="S"
                    variant="danger"
                    onPress={() => onSubmit({ token: "" })}
                  >
                    Remove
                  </Button>
                ) : null}
                <Button
                  size="S"
                  variant={isDirty ? "primary" : "default"}
                  onPress={() => handleSubmit(onSubmit)()}
                  isDisabled={!githubEnabled || !isDirty}
                >
                  Save
                </Button>
              </Flex>
            </Flex>
          </Form>
        ) : (
          // The env-level flag is off, so the feature UI is hidden — but the
          // saved token must always remain purgeable from this browser.
          <Flex direction="row" gap="size-100" justifyContent="end">
            <Button
              size="S"
              variant="danger"
              onPress={() => onSubmit({ token: "" })}
            >
              Remove
            </Button>
          </Flex>
        )}
      </div>
      {githubServerEnabled && !githubEnabled ? (
        <SystemSettingsWarning isAdmin={isAdmin} isOnSettingsPage />
      ) : null}
    </li>
  );
}
