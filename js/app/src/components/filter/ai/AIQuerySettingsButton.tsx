import { css } from "@emotion/react";
import { Suspense } from "react";

import {
  DialogTrigger,
  Flex,
  Icon,
  IconButton,
  Icons,
  LinkButton,
  Loading,
  MenuFooter,
  Popover,
  Text,
  View,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { AIQueryModelPicker } from "./AIQueryModelPicker";
import { resolveAIQueryModelConfig } from "./types";

/**
 * The AI query row of the settings dropdown — setting name on the left,
 * the model picker (or "Off") on the right. Warnings from the picker (a
 * missing credential, an unusable browser model) are the only thing that
 * adds a second line. Enabling and disabling the feature lives on the
 * Generative AI page (linked in the dropdown's footer), not here.
 */
function AIQueryRow() {
  const isEnabled = usePreferencesContext((state) => state.isAIQueryEnabled);
  const modelConfig = resolveAIQueryModelConfig(
    usePreferencesContext((state) => state.aiQueryModelConfig)
  );
  const setModelConfig = usePreferencesContext(
    (state) => state.setAIQueryModelConfig
  );
  return (
    <Flex
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap="size-200"
    >
      <Text weight="heavy" size="S">
        AI Query
      </Text>
      {isEnabled ? (
        <Suspense fallback={<Loading size="S" />}>
          <AIQueryModelPicker
            config={modelConfig}
            onConfigChange={setModelConfig}
            isCompact
          />
        </Suspense>
      ) : (
        <Text size="S" color="text-700">
          Off
        </Text>
      )}
    </Flex>
  );
}

/**
 * The settings entry point on a filter field: a gear button whose dropdown
 * holds the field's settings — today the AI query row, with the
 * Generative AI page linked in the footer for everything else (including
 * turning the feature on and off). The settings are global, so the same
 * configuration appears on the settings and profile pages.
 */
export function AIQuerySettingsButton() {
  return (
    <DialogTrigger>
      <IconButton size="XS" aria-label="AI query settings">
        <Icon svg={<Icons.Settings />} />
      </IconButton>
      <Popover
        placement="bottom end"
        css={css`
          overflow: auto;
          overscroll-behavior: none;
        `}
      >
        <View paddingX="size-200" paddingY="size-150" minWidth="280px">
          <AIQueryRow />
        </View>
        <MenuFooter>
          <LinkButton
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.Sparkles />} />}
            to="/profile/generative-ai"
          >
            Generative AI settings
          </LinkButton>
        </MenuFooter>
      </Popover>
    </DialogTrigger>
  );
}
