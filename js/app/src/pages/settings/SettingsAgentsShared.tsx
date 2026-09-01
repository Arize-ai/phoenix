import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Badge, Flex, Heading, Switch, Text } from "@phoenix/components";

/**
 * The topical tabs of the assistant settings page, in display order. The tab
 * id doubles as the value of the `tab` search param so each tab is
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
 * Whether the server-side agent runtime (bash tool, subagents, experimental
 * capabilities) is enabled for this deployment. False when
 * PHOENIX_AGENTS_DISABLE_BASH is set, which prevents those capabilities from
 * being constructed server-side — settings that only configure them are
 * hidden rather than offered as inert switches. Does not affect the frontend
 * bash tool.
 */
export function isServerAgentRuntimeEnabled(
  agentBashDisabled: boolean
): boolean {
  return !agentBashDisabled;
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
 * Layout for a full-width switch row inside {@link settingsRowsCSS} or
 * {@link groupedSettingsRowsCSS}: label block on the left, switch on the
 * right.
 */
export const settingsSwitchCSS = css`
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
  return <Badge size="S">System</Badge>;
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
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <Flex direction="column" gap="size-150">
        <Flex direction="column" gap="size-50">
          <Heading level={3} weight="heavy">
            {title}
          </Heading>
          <Text color="text-500" size="XS">
            {description}
          </Text>
        </Flex>
        {children}
      </Flex>
    </section>
  );
}

/**
 * A switch setting row with a heavy title (plus optional badge, e.g.
 * {@link SystemBadge}) and a muted description.
 */
export function SettingsSwitchRow({
  title,
  titleExtra,
  description,
  isSelected,
  onChange,
  isDisabled,
}: {
  title: string;
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
