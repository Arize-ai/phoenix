import React from "react";

import { Card } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function PlaygroundTemplate() {
  // TODO: remove the hard coding of the first instance
  const playgrounds = usePlaygroundContext((state) => state.playgrounds);
  const playground = playgrounds[0];
  if (!playground) {
    return null;
  }

  return (
    <Card title="Template" collapsible variant="compact">
      {JSON.stringify(playground.template)}
    </Card>
  );
}
