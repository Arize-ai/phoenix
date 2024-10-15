import React from "react";

import { Flex } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  selectDerivedInputVariables,
  selectInputVariableKeys,
} from "@phoenix/store";

import { VariableEditor } from "./VariableEditor";

export function PlaygroundInput() {
  const variables = usePlaygroundContext(selectDerivedInputVariables);
  const variableKeys = usePlaygroundContext(selectInputVariableKeys);
  const setVariableValue = usePlaygroundContext(
    (state) => state.setVariableValue
  );
  return (
    <Flex direction="column" gap="size-200" width="100%">
      {variableKeys.map((key) => {
        return (
          <VariableEditor
            key={key}
            label={key}
            value={variables[key]}
            onChange={(value) => setVariableValue(key, value)}
          />
        );
      })}
    </Flex>
  );
}
