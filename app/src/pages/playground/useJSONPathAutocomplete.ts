import { useMemo } from "react";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { PathAutocompleteOption } from "@phoenix/components/templateEditor/language/jsonPath";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  flattenObject,
  safelyParseJSONObjectString,
} from "@phoenix/utils/jsonUtils";

const JSON_DATA_KEY = "__json_data__";

/**
 * Hook that generates autocomplete options for JSON_PATH template format
 * by flattening the JSON input data into paths.
 *
 * This follows the pattern used in EvaluatorInputMapping's `useFlattenedEvaluatorInputKeys`.
 */
export function useJSONPathAutocomplete(): PathAutocompleteOption[] {
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const input = usePlaygroundContext((state) => state.input);

  return useMemo(() => {
    // Only generate autocomplete for JSON_PATH format
    if (templateFormat !== TemplateFormats.JSONPath) {
      return [];
    }

    const jsonValue = input.variablesValueCache?.[JSON_DATA_KEY] ?? "{}";
    const parsedData = safelyParseJSONObjectString(jsonValue);

    if (!parsedData) {
      return [];
    }

    // Flatten the JSON object to get all possible paths
    const flat = flattenObject({
      obj: parsedData,
      keepNonTerminalValues: true,
      formatIndices: true,
    });

    // Convert to autocomplete options with JSONPath syntax ($.)
    return Object.keys(flat).map((key) => ({
      id: `$.${key}`,
      label: `$.${key}`,
    }));
  }, [templateFormat, input.variablesValueCache]);
}
