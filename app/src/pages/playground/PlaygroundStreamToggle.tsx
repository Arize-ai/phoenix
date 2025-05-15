import { Switch } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

export function PlaygroundStreamToggle() {
  const streaming = usePlaygroundContext((state) => state.streaming);
  const setStreaming = usePlaygroundContext((state) => state.setStreaming);
  const setPlaygroundStreamingEnabled = usePreferencesContext(
    (state) => state.setPlaygroundStreamingEnabled
  );

  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );

  return (
    <Switch
      labelPlacement="start"
      isSelected={streaming}
      onChange={() => {
        setStreaming(!streaming);
        setPlaygroundStreamingEnabled(!streaming);
      }}
      isDisabled={isRunning}
    >
      Stream
    </Switch>
  );
}
