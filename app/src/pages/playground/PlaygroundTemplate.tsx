import React from "react";

import { Card } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function PlaygroundTemplate() {
  const operationType = usePlaygroundContext((state) => state.operationType);
  return (
    <Card title="Template" collapsible variant="compact">
      {operationType === "chat" ? (
        <div>Chat Template goes here</div>
      ) : (
        <div>Completion Template goes here</div>
      )}
    </Card>
  );
}
