import { css } from "@emotion/react";

import {
  DialogTrigger,
  Icon,
  IconButton,
  Icons,
  Popover,
  View,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { AISearchSettingsForm } from "./AISearchSettingsForm";

const settingsButtonCSS = css`
  &[data-ai-enabled="true"] {
    color: var(--pxi-treatment-color-middle);
    &:hover {
      color: var(--pxi-treatment-color-end);
    }
  }
`;

/**
 * The AI-search entry point on a filter field: a sparkle button whose
 * popover holds the AI search configuration. The setting is global —
 * enabling AI search here enables it on every filter field that supports
 * it, and the same configuration appears on the settings and profile pages.
 */
export function AISearchSettingsButton() {
  const isEnabled = usePreferencesContext((state) => state.isAISearchEnabled);
  return (
    <DialogTrigger>
      <IconButton
        size="S"
        aria-label="AI search settings"
        className="ai-search-settings-button"
        data-ai-enabled={isEnabled}
        css={settingsButtonCSS}
      >
        <Icon svg={<Icons.Sparkles />} />
      </IconButton>
      <Popover
        placement="bottom end"
        css={css`
          overflow: auto;
          overscroll-behavior: none;
        `}
      >
        <View padding="size-200" width="340px">
          <AISearchSettingsForm />
        </View>
      </Popover>
    </DialogTrigger>
  );
}
