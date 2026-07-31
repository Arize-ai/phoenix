import { Card, View } from "@phoenix/components";

import { AISearchSettingsForm } from "./AISearchSettingsForm";

/**
 * The AI search configuration presented as a settings card — the same form
 * the filter field's sparkle popover shows, for the settings and profile
 * pages. All surfaces read and write the same persisted preference.
 */
export function AISearchSettingsCard() {
  return (
    <Card title="AI Search">
      <View padding="size-200">
        <AISearchSettingsForm />
      </View>
    </Card>
  );
}
