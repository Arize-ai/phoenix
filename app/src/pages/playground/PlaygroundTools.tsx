import React from "react";

import { Card } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { TitleWithAlphabeticIndex } from "./TitleWithAlphabeticIndex";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundToolsProps extends PlaygroundInstanceProps {}
export function PlaygroundTools(props: PlaygroundToolsProps) {
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex(
      (instance) => instance.id === props.playgroundInstanceId
    )
  );
  return (
    <Card
      title={<TitleWithAlphabeticIndex index={index} title="Tools" />}
      collapsible
      variant="compact"
    >
      Tools go here
    </Card>
  );
}
