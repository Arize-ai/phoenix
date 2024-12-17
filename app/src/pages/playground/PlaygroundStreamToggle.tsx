import React from "react";

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

  // This toggle should never be shown if websockets are disabled
  if (window.Config.websocketsEnabled === false) {
    return null;
  }

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
