import React from "react";

import { Button, Card, Icon, Icons } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {}

export function PlaygroundTemplate(props: PlaygroundTemplateProps) {
  const index = props.playgroundInstanceIndex;
  // TODO: remove the hard coding of the first instance
  const playgrounds = usePlaygroundContext((state) => state.instances);
  const playground = playgrounds[index];
  if (!playground) {
    throw new Error(`Playground instance ${index} not found`);
  }
  return (
    <Card
      title="Template"
      collapsible
      variant="compact"
      extra={<CompareOrDeleteButton />}
    >
      {JSON.stringify(playground.template)}
    </Card>
  );
}

/**
 * A Button that either lets you compare or delete the playground instance.
 */
function CompareOrDeleteButton() {
  const addInstance = usePlaygroundContext((state) => state.addInstance);
  return (
    <Button
      variant="default"
      size="compact"
      icon={<Icon svg={<Icons.ArrowCompareOutline />} />}
      onClick={() => {
        addInstance();
      }}
    />
  );
}
