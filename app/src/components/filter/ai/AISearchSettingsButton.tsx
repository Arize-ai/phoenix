import { css } from "@emotion/react";

import {
  DialogTrigger,
  Icon,
  IconButton,
  Icons,
  Popover,
  View,
} from "@phoenix/components";

import { AISearchSettingsForm } from "./AISearchSettingsForm";

/**
 * The AI-search configuration entry point on a filter field: a gear button
 * whose popover holds the AI search settings. The setting is global —
 * enabling AI search here enables it on every filter field that supports
 * it, and the same configuration appears on the settings and profile pages.
 * Mode switching belongs to the sparkle toggle next to it.
 */
export function AISearchSettingsButton() {
  return (
    <DialogTrigger>
      <IconButton size="XS" aria-label="AI search settings">
        <Icon svg={<Icons.Settings />} />
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
