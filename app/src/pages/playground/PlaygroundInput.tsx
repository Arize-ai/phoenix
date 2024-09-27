import React from "react";

import { Card } from "@arizeai/components";

import { PlaygroundInputTypeTypeRadioGroup } from "./PlaygroundInputModeRadioGroup";

export function PlaygroundInput() {
  return (
    <Card
      title="Input"
      collapsible
      variant="compact"
      extra={<PlaygroundInputTypeTypeRadioGroup />}
    >
      Input goes here
    </Card>
  );
}
