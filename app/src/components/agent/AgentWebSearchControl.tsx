import { css } from "@emotion/react";
import { MenuSection } from "react-aria-components";

import {
  Flex,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuSectionTitle,
  Text,
  VisuallyHidden,
} from "@phoenix/components";
import { useAgentModelWebSearchSupport } from "@phoenix/components/agent/useAgentModelWebSearchSupport";
import type { AgentModelSelection } from "@phoenix/components/agent/useGenerateSessionSummary";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { selectEffectiveWebAccess } from "@phoenix/store";

/** Visual + a11y description for each web-search icon state. */
export type WebSearchIconState = "on" | "off" | "unsupported";

const triggerIconCSS = css`
  display: inline-flex;
  align-items: center;
  font-size: var(--global-font-size-s);
`;

const menuCSS = css`
  min-width: 320px;
`;

const menuItemCSS = css`
  .agent-web-search-item__description {
    white-space: normal;
  }
`;

const WEB_SEARCH_ICON_LABEL: Record<WebSearchIconState, string> = {
  on: "Web search enabled",
  off: "Web search disabled",
  unsupported: "Web search not available for this model",
};

function getWebSearchIconState({
  support,
  effectiveEnabled,
}: {
  support: "loading" | "supported" | "unsupported";
  effectiveEnabled: boolean;
}): WebSearchIconState {
  if (support === "unsupported") {
    return "unsupported";
  }
  // While loading we optimistically reflect the toggle so the icon does not
  // flicker between states on every model change.
  return effectiveEnabled ? "on" : "off";
}

/**
 * Derives the web-search affordance state for a session/model pair.
 *
 * Composes the instance-level availability gate, the global agent-settings
 * `web.access` toggle (which is also the per-session default), the per-session
 * override, and the selected model's provider-native web search support.
 *
 * `show` is false when web search must be hidden entirely (unavailable or
 * globally disabled); callers should render neither the trigger icon nor the
 * menu section in that case.
 */
export function useAgentWebSearch({
  sessionId,
  modelSelection,
  hasSelection = true,
}: {
  sessionId: string | null;
  modelSelection: AgentModelSelection;
  /**
   * Whether `modelSelection` is a real selection rather than a placeholder.
   * When false, the support request is skipped so callers can run the hook
   * unconditionally (hooks rule) without issuing a wasteful, always-failing
   * mutation for a placeholder model.
   */
  hasSelection?: boolean;
}) {
  // Instance-level gate: the Phoenix deployment must permit web access at all.
  const isWebAccessAvailable = useAgentContext(
    (state) => state.agentsConfig.webAccessEnabled
  );
  // Global agent-settings toggle, which also serves as the per-session default.
  const isWebAccessEnabledGlobally = useAgentContext(
    (state) => state.capabilities["web.access"]
  );
  const effectiveWebAccess = useAgentContext((state) =>
    selectEffectiveWebAccess(state, sessionId)
  );
  const setSessionWebAccess = useAgentContext(
    (state) => state.setSessionWebAccess
  );

  // Web search is only surfaced when the instance permits web access AND the
  // global agent setting is enabled. When it is unavailable or globally
  // disabled, the section and the trigger icon are hidden entirely.
  const show = isWebAccessAvailable && isWebAccessEnabledGlobally;

  const support = useAgentModelWebSearchSupport(modelSelection, {
    enabled: show && hasSelection,
  });

  const canToggle = support === "supported" && sessionId !== null;
  const iconState = getWebSearchIconState({
    support,
    effectiveEnabled: effectiveWebAccess,
  });

  const setEnabled = (enabled: boolean) => {
    if (!canToggle || sessionId === null) {
      return;
    }
    setSessionWebAccess(sessionId, enabled);
  };

  return {
    show,
    support,
    canToggle,
    effectiveWebAccess,
    iconState,
    setEnabled,
  };
}

export type AgentWebSearchState = ReturnType<typeof useAgentWebSearch>;

/**
 * The web-search state icon for a menu trigger. Renders a globe reflecting the
 * enabled / disabled / unavailable state, with a visually-hidden label.
 */
export function AgentWebSearchTriggerIcon({
  iconState,
}: {
  iconState: WebSearchIconState;
}) {
  const svg =
    iconState === "on" ? (
      <Icons.Globe />
    ) : iconState === "off" ? (
      <Icons.GlobeOff />
    ) : (
      <Icons.GlobeX />
    );
  return (
    <>
      <span css={triggerIconCSS} aria-hidden="true">
        <Icon svg={svg} />
      </span>
      <VisuallyHidden>{WEB_SEARCH_ICON_LABEL[iconState]}</VisuallyHidden>
    </>
  );
}

/**
 * A standalone web-search toggle menu rendered alongside other menus in a
 * shared `MenuContainer`.
 *
 * Uses a multi-select menu with a single key so the row keeps a stable label
 * and only its checkmark changes. When the model does not support web search
 * the item is disabled and never selected.
 */
export function AgentWebSearchMenu({
  support,
  canToggle,
  effectiveWebAccess,
  setEnabled,
}: Pick<
  AgentWebSearchState,
  "support" | "canToggle" | "effectiveWebAccess" | "setEnabled"
>) {
  return (
    <Menu
      css={menuCSS}
      selectionMode="multiple"
      disabledKeys={canToggle ? [] : ["web-search"]}
      selectedKeys={canToggle && effectiveWebAccess ? ["web-search"] : []}
      onSelectionChange={(keys) => {
        if (!canToggle || keys === "all") {
          return;
        }
        setEnabled((keys as Set<string>).has("web-search"));
      }}
    >
      <MenuSection>
        <MenuSectionTitle title="Web Search" />
        <MenuItem
          key="web-search"
          id="web-search"
          textValue="Web search"
          css={menuItemCSS}
        >
          <Flex direction="column" gap="size-25">
            <Text weight="heavy">Web search</Text>
            <Text
              size="XS"
              color="text-700"
              className="agent-web-search-item__description"
            >
              {support === "loading"
                ? "Checking whether this model supports web search\u2026"
                : support === "unsupported"
                  ? "Not available for the selected model. Choose a different model to enable it."
                  : "Lets PXI use provider-native web search for this session."}
            </Text>
          </Flex>
        </MenuItem>
      </MenuSection>
    </Menu>
  );
}
