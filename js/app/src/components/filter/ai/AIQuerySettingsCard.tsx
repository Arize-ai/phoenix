import { Card, Switch, View } from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { AIQuerySettingsForm } from "./AIQuerySettingsForm";

/**
 * The AI query configuration presented as a settings card — the same form
 * the filter field's gear popover shows, for the settings and profile
 * pages. The enable switch lives in the card header so the body is purely
 * the model choice. All surfaces read and write the same persisted
 * preference.
 */
export function AIQuerySettingsCard() {
  const isEnabled = usePreferencesContext((state) => state.isAIQueryEnabled);
  const setIsEnabled = usePreferencesContext(
    (state) => state.setIsAIQueryEnabled
  );
  return (
    <Card
      title="AI Query"
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
        <AIQuerySettingsForm />
      </View>
    </Card>
  );
}
