import { Flex, Text, View } from "@phoenix/components";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { assertUnreachable } from "@phoenix/typeUtils";

import { JSONInputEditor } from "./JSONInputEditor";
import { useDerivedPlaygroundVariables } from "./useDerivedPlaygroundVariables";
import { VariableEditor } from "./VariableEditor";

const JSON_DATA_KEY = "__json_data__";

export function PlaygroundInput() {
  const { variableKeys, variablesMap } = useDerivedPlaygroundVariables();
  const setVariableValue = usePlaygroundContext(
    (state) => state.setVariableValue
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const input = usePlaygroundContext((state) => state.input);

  // For JSON_PATH format, use a single JSON editor instead of individual variable fields
  if (templateFormat === TemplateFormats.JSONPath) {
    const jsonValue = input.variablesValueCache?.[JSON_DATA_KEY] ?? "{}";
    return (
      <JSONInputEditor
        value={jsonValue}
        onChange={(value) => setVariableValue(JSON_DATA_KEY, value)}
      />
    );
  }

  if (variableKeys.length === 0) {
    let templateSyntax = "";
    switch (templateFormat) {
      case TemplateFormats.FString: {
        templateSyntax = "{input name}";
        break;
      }
      case TemplateFormats.Mustache: {
        templateSyntax = "{{input name}}";
        break;
      }
      case TemplateFormats.NONE: {
        return null;
      }
      default:
        assertUnreachable(templateFormat);
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
            defaultValue={variablesMap[variableKey] ?? ""}
            onChange={(value) => setVariableValue(variableKey, value)}
          />
        );
      })}
    </Flex>
  );
}
