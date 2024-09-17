import React from "react";

import { Card } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function PlaygroundTemplate() {
  const invocationMode = usePlaygroundContext((state) => state.invocationMode);
  return (
    <Card title="Template" collapsible variant="compact">
      {invocationMode === "chat" ? (
        <div>Chat Template goes here</div>
      ) : (
        <div>Completion Template goes here</div>
      )}
    </Card>
  );
}
