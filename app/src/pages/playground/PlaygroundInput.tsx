import React from "react";

import { Card, Flex, TextArea } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  selectDerivedInputVariables,
  selectInputVariableKeys,
} from "@phoenix/store";

export function PlaygroundInput() {
  const variables = usePlaygroundContext(selectDerivedInputVariables);
  const variableKeys = usePlaygroundContext(selectInputVariableKeys);
  const setVariableValue = usePlaygroundContext(
    (state) => state.setVariableValue
  );
  return (
    <Card title="Input" collapsible variant="compact">
      <Flex direction="column" gap="size-200" width="100%">
        {variableKeys.map((key) => {
          return (
            <TextArea
              key={key}
              label={key}
              value={variables[key]}
              height={65}
              onChange={(value) => {
                setVariableValue(key, value);
              }}
            />
          );
        })}
      </Flex>
    </Card>
  );
}
