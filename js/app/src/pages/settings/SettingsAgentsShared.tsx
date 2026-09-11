import { css } from "@emotion/react";
import type { ReactNode } from "react";
import type { GraphQLTaggedNode } from "react-relay";
import { useMutation } from "react-relay";
import type { MutationParameters } from "relay-runtime";

import { Badge, Flex, Heading, Icon, Switch, Text } from "@phoenix/components";
import { useNotifyError } from "@phoenix/contexts";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import type { AgentState } from "@phoenix/store/agentStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * The topical tabs of the assistant settings page, in display order. Each tab
 * is its own nested route under /settings/agents — the tab id doubles as the
 * route's path segment (the general tab is the index route) so each tab is
 * deep-linkable.
 */
export const SETTINGS_AGENTS_TABS = [
  { id: "general", label: "General" },
  { id: "tools", label: "Tools" },
  { id: "permissions", label: "Permissions" },
  { id: "tracing", label: "Tracing & privacy" },
  { id: "chats", label: "Chats & data" },
] as const satisfies readonly { id: string; label: string }[];

export type SettingsAgentsTabId = (typeof SETTINGS_AGENTS_TABS)[number]["id"];

export function isSettingsAgentsTabId(
  value: unknown
): value is SettingsAgentsTabId {
  return SETTINGS_AGENTS_TABS.some((tab) => tab.id === value);
}

/**
 * The absolute path of an assistant settings tab. The general tab is the
 * index route of /settings/agents; every other tab is a child path segment.
 */
export function settingsAgentsTabPath(tabId: SettingsAgentsTabId): string {
  return tabId === "general" ? "/settings/agents" : `/settings/agents/${tabId}`;
}

/**
 * Whether the server-side agent runtime (bash tool, subagents, experimental
 * capabilities) is enabled for this deployment. False when
 * PHOENIX_AGENTS_DISABLE_BASH is set, which prevents those capabilities from
 * being constructed server-side — settings that only configure them are
 * hidden rather than offered as inert switches. Does not affect the frontend
 * bash tool.
 */
export function isServerAgentRuntimeEnabled(): boolean {
  return !window.Config.agentBashDisabled;
}

/**
 * Commits a system-settings mutation and folds the server's response back
 * into the agent store, with the shared error-toast handling. Each tab
 * supplies only its graphql tag, an error title, and how the response maps
 * onto the agents config.
 */
export function useAgentsConfigMutation<TMutation extends MutationParameters>({
  mutation,
  errorTitle,
  applyResponse,
}: {
  mutation: GraphQLTaggedNode;
  errorTitle: string;
  applyResponse: (
    response: TMutation["response"]
  ) => Parameters<AgentState["setAgentsConfig"]>[0];
}): [(variables: TMutation["variables"]) => void, boolean] {
  const store = useAgentStore();
  const notifyError = useNotifyError();
  const [commitMutation, isPending] = useMutation<TMutation>(mutation);
  const commit = (variables: TMutation["variables"]) => {
    commitMutation({
      variables,
      onCompleted: (response) => {
        store.getState().setAgentsConfig(applyResponse(response));
      },
      onError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: errorTitle,
          message: messages?.[0] ?? error.message,
        });
      },
    });
  };
  return [commit, isPending];
}

/**
 * A list of standalone setting rows: each `<li>` is its own bordered card.
 */
export const settingsRowsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);
  list-style: none;
  margin: 0;
  padding: 0;

  > li {
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-medium);
    background: var(--global-background-color-primary);
  }
`;

/**
 * A list of related setting rows grouped into a single bordered card with a
 * separator between rows. Used to pair a system gate with the personal
 * setting it controls so the dependency between the two is visible.
 */
export const groupedSettingsRowsCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-primary);

  > li + li {
    border-top: 1px solid var(--global-border-color-default);
  }
`;

/**
 * The body area rendered under a setting row's switch, flush with the row's
 * horizontal padding (e.g. a token form or a retention value input).
 */
export const settingsRowBodyCSS = css`
  padding: 0 var(--global-dimension-size-150) var(--global-dimension-size-150);
`;

/**
 * Layout for a full-width switch row inside {@link settingsRowsCSS} or
 * {@link groupedSettingsRowsCSS}: label block on the left, switch on the
 * right.
 */
const settingsSwitchCSS = css`
  width: 100%;
  box-sizing: border-box;
  white-space: normal;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--global-dimension-size-150);
  gap: var(--global-dimension-size-200);

  .assistant-settings-row__label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }

  .assistant-settings-row__title {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
`;

/**
 * Marks a setting that applies to everyone using this Phoenix instance and
 * can only be changed by admins.
 */
export function SystemBadge() {
  return <Badge size="S">system</Badge>;
}

/**
 * A titled group of settings within an assistant settings tab.
 */
export function SettingsAgentsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <Flex direction="column" gap="size-150">
        <Flex direction="column" gap="size-50">
          <Heading level={3} weight="heavy">
            {title}
          </Heading>
          {description ? (
            <Text color="text-500" size="XS">
              {description}
            </Text>
          ) : null}
        </Flex>
        {children}
      </Flex>
    </section>
  );
}

/**
 * Layout for a non-switch setting row inside {@link settingsRowsCSS} or
 * {@link groupedSettingsRowsCSS}: label block on the left, an arbitrary
 * control on the right, optional full-width content below.
 */
const settingsFieldRowCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-150);

  .assistant-settings-row__main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-200);
  }

  .assistant-settings-row__label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }
`;

/**
 * A setting row with a heavy title, a muted description, and an arbitrary
 * control at the end of the row — the non-switch counterpart of
 * {@link SettingsSwitchRow}. Children render full-width below the row, e.g.
 * a warning alert.
 */
export function SettingsFieldRow({
  title,
  description,
  control,
  children,
}: {
  title: string;
  description: ReactNode;
  /** The control rendered at the end of the row, e.g. a menu or button. */
  control: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div css={settingsFieldRowCSS}>
      <div className="assistant-settings-row__main">
        <span className="assistant-settings-row__label">
          <Text weight="heavy">{title}</Text>
          <Text color="text-500" size="S">
            {description}
          </Text>
        </span>
        {control}
      </div>
      {children}
    </div>
  );
}

/**
 * A switch setting row with a heavy title (plus optional icon and badge, e.g.
 * {@link SystemBadge}) and a muted description.
 */
export function SettingsSwitchRow({
  title,
  icon,
  titleExtra,
  description,
  isSelected,
  onChange,
  isDisabled,
}: {
  title: string;
  /** Icon svg rendered before the title, e.g. `<Icons.GitHub />`. */
  icon?: ReactNode;
  /** Rendered inline after the title, e.g. a `System` badge. */
  titleExtra?: ReactNode;
  description: ReactNode;
  isSelected: boolean;
  onChange: (next: boolean) => void;
  isDisabled?: boolean;
}) {
  return (
    <Switch
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      labelPlacement="start"
      css={settingsSwitchCSS}
    >
      <span className="assistant-settings-row__label">
        <span className="assistant-settings-row__title">
          {icon ? <Icon svg={icon} /> : null}
          <Text weight="heavy">{title}</Text>
          {titleExtra}
        </span>
        <Text color="text-500" size="S">
          {description}
        </Text>
      </span>
    </Switch>
  );
}
