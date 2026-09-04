import { Suspense } from "react";

import { Flex, Icon, Icons, Label, Loading, Text } from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { AIQueryModelPicker } from "./AIQueryModelPicker";
import { CardFootnote } from "./CardFootnote";
import { resolveAIQueryModelConfig } from "./types";

/**
 * The AI query configuration for the settings and profile cards: the
 * feature description and, when the feature is enabled, the model choice —
 * one picker offering Browser AI (the on-device built-in model, the default
 * where available) alongside providers called through the Phoenix server
 * with credentials configured there. The hosting card owns the enable
 * switch (in its header); the filter field's gear popover renders the
 * compact dropdown instead. All surfaces read and write the same persisted
 * preference.
 */
export function AIQuerySettingsForm() {
  const isEnabled = usePreferencesContext((state) => state.isAIQueryEnabled);
  const modelConfig = resolveAIQueryModelConfig(
    usePreferencesContext((state) => state.aiQueryModelConfig)
  );
  const setModelConfig = usePreferencesContext(
    (state) => state.setAIQueryModelConfig
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
              <AIQueryModelPicker
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
