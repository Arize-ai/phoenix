import { Card, Switch, View } from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { AISearchSettingsForm } from "./AISearchSettingsForm";

/**
 * The AI search configuration presented as a settings card — the same form
 * the filter field's gear popover shows, for the settings and profile
 * pages. The enable switch lives in the card header so the body is purely
 * the model choice. All surfaces read and write the same persisted
 * preference.
 */
export function AISearchSettingsCard() {
  const isEnabled = usePreferencesContext((state) => state.isAISearchEnabled);
  const setIsEnabled = usePreferencesContext(
    (state) => state.setIsAISearchEnabled
  );
  return (
    <Card
      title="AI Search"
      extra={
        <Switch
          size="S"
          labelPlacement="start"
          isSelected={isEnabled}
          onChange={setIsEnabled}
        >
          Enabled
        </Switch>
      }
    >
      <View padding="size-200">
        <AISearchSettingsForm />
      </View>
    </Card>
  );
}
