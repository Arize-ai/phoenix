import { isTemplateFormat } from "@phoenix/components/templateEditor/types";

import type {
  EditLlmEvaluatorDraftOperation,
  LLMEvaluatorDraftSnapshot,
  LlmEvaluatorActionResult,
} from "./types";

export function applyDraftOperations({
  snapshot,
  operations,
}: {
  snapshot: LLMEvaluatorDraftSnapshot;
  operations: EditLlmEvaluatorDraftOperation[];
}): LlmEvaluatorActionResult<LLMEvaluatorDraftSnapshot> {
  let next: LLMEvaluatorDraftSnapshot = { ...snapshot };
  for (const operation of operations) {
    switch (operation.type) {
      case "set_name": {
        next = { ...next, name: operation.name };
        break;
      }
      case "set_description": {
        next = { ...next, description: operation.description };
        break;
      }
      case "set_input_mapping": {
        next = { ...next, inputMapping: operation.inputMapping };
        break;
      }
      case "set_test_payload": {
        next = { ...next, testPayload: operation.testPayload };
        break;
      }
      case "set_include_explanation": {
        next = { ...next, includeExplanation: operation.includeExplanation };
        break;
      }
      case "set_output_configs": {
        next = { ...next, outputConfigs: operation.outputConfigs };
        break;
      }
      case "set_judge_prompt": {
        const templateFormat =
          operation.templateFormat != null &&
          isTemplateFormat(operation.templateFormat)
            ? operation.templateFormat
            : next.judge.templateFormat;
        next = {
          ...next,
          judge: {
            ...next.judge,
            messages: operation.messages,
            templateFormat,
          },
        };
        break;
      }
      case "set_judge_model": {
        next = {
          ...next,
          judge: {
            ...next.judge,
            model: operation.model,
            provider: operation.provider,
            ...(operation.invocationParameters !== undefined
              ? { invocationParameters: operation.invocationParameters }
              : {}),
          },
        };
        break;
      }
    }
  }
  return { ok: true, output: next };
}
