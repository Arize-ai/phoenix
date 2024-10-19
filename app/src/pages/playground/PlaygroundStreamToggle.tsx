import React from "react";

import { Switch } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function PlaygroundStreamToggle() {
  const streaming = usePlaygroundContext((state) => state.streaming);
  const setStreaming = usePlaygroundContext((state) => state.setStreaming);

  return (
    <Switch
      labelPlacement="start"
      isSelected={streaming}
      onChange={() => {
        setStreaming(!streaming);
      }}
    >
      Stream
    </Switch>
  );
}
