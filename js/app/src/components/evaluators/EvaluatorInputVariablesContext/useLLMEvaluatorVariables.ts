import { useMemo } from "react";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";

/** An f-string name's root, before the member, index or format spec after it. */
const F_STRING_ROOT_PATTERN = /^([A-Za-z_]\w*)(?:$|[.[!:])/;

/**
 * The variables an LLM evaluator's prompt reads, as the server infers its
 * input schema: an f-string name reads its root, as a Mustache name already
 * does, and a name with no root to read (`{}`, `{.x}`) reads nothing.
 */
export function toLLMEvaluatorVariables({
  names,
  templateFormat,
}: {
  names: readonly string[];
  templateFormat: TemplateFormat;
}): string[] {
  if (templateFormat !== TemplateFormats.FString) {
    return [...names];
  }
  const roots = names.flatMap(
    (name) => F_STRING_ROOT_PATTERN.exec(name)?.slice(1, 2) ?? []
  );
  return [...new Set(roots)];
}

export function useLLMEvaluatorVariables({
  instanceId,
}: { instanceId?: number } = {}): string[] {
  const { variableKeys } = useDerivedPlaygroundVariables({ instanceId });
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  return useMemo(
    () => toLLMEvaluatorVariables({ names: variableKeys, templateFormat }),
    [variableKeys, templateFormat]
  );
}
