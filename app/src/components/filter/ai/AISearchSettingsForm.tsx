import { Suspense } from "react";

import { Flex, Icon, Icons, Label, Loading, Text } from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { AISearchModelPicker } from "./AISearchModelPicker";
import { CardFootnote } from "./CardFootnote";
import { resolveAISearchModelConfig } from "./types";

/**
 * The AI search configuration for the settings and profile cards: the
 * feature description and, when the feature is enabled, the model choice —
 * one picker offering Browser AI (the on-device built-in model, the default
 * where available) alongside hosted model providers called with your
 * configured credentials. The hosting card owns the enable switch (in its
 * header); the filter field's gear popover renders the compact dropdown
 * instead. All surfaces read and write the same persisted preference.
 */
export function AISearchSettingsForm() {
  const isEnabled = usePreferencesContext((state) => state.isAISearchEnabled);
  const modelConfig = resolveAISearchModelConfig(
    usePreferencesContext((state) => state.aiSearchModelConfig)
  );
  const setModelConfig = usePreferencesContext(
    (state) => state.setAISearchModelConfig
  );
  return (
    <Flex direction="column" gap="size-150">
      <Text size="XS" color="text-700">
        Describe a filter in plain language and press Enter to convert it to a
        filter expression.
      </Text>
      {isEnabled ? (
        <>
          <div css={fieldBaseCSS}>
            <Label>Model</Label>
            <Suspense fallback={<Loading size="S" />}>
              <AISearchModelPicker
                config={modelConfig}
                onConfigChange={setModelConfig}
              />
            </Suspense>
          </div>
          <CardFootnote icon={<Icon svg={<Icons.Lock />} />}>
            Only your query and the filter field vocabulary are sent to the
            model.
          </CardFootnote>
        </>
      ) : null}
    </Flex>
  );
}
