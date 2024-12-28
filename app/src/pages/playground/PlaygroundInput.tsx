import React from "react";

import { Flex, Text, View } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { assertUnreachable } from "@phoenix/typeUtils";

import { useDerivedPlaygroundVariables } from "./useDerivedPlaygroundVariables";
import { VariableEditor } from "./VariableEditor";

export function PlaygroundInput() {
  const { variableKeys, variablesMap } = useDerivedPlaygroundVariables();
  const setVariableValue = usePlaygroundContext(
    (state) => state.setVariableValue
  );
  const templateLanguage = usePlaygroundContext(
    (state) => state.templateLanguage
  );
  if (variableKeys.length === 0) {
    let templateSyntax = "";
    switch (templateLanguage) {
      case "F_STRING": {
        templateSyntax = "{input name}";
        break;
      }
      case "MUSTACHE": {
        templateSyntax = "{{input name}}";
        break;
      }
      case "NONE": {
        return null;
      }
      default:
        assertUnreachable(templateLanguage);
    }
    return (
      <View padding="size-100">
        <Flex direction="column" justifyContent="center" alignItems="center">
          <Text color="text-700">
            Add variable inputs to your prompt using{" "}
            <Text color="text-900">{templateSyntax}</Text> within your prompt
            template.
          </Text>
        </Flex>
      </View>
    );
  }

  return (
    <Flex direction="column" gap="size-200" width="100%">
      {variableKeys.map((variableKey, i) => {
        return (
          <VariableEditor
            // using the index as the key actually prevents the UI from
            // flickering; if we use the variable key directly, it will
            // re-mount the entire editor and cause a flicker because key may
            // change rapidly for a given variable
            key={i}
            label={variableKey}
            value={variablesMap[variableKey]}
            onChange={(value) => setVariableValue(variableKey, value)}
          />
        );
      })}
    </Flex>
  );
}
