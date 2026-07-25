import type { ModelMessage } from "ai";
import Mustache from "mustache";

import type { PromptTemplate, RenderedPrompt } from "../types/templating";
import { createTemplateVariablesProxy } from "./createTemplateVariablesProxy";

/**
 * A function that applies a set of variables to a template (e.g. a prompt)
 * Uses the Mustache library to apply the variables to the template
 */
export function formatTemplate(args: {
  template: PromptTemplate;
  variables: Record<string, unknown>;
}): RenderedPrompt {
  const { template, variables } = args;
  const variablesProxy = createTemplateVariablesProxy(variables);
  if (typeof template === "string") {
    return renderTemplateString(template, variablesProxy);
  }
  // Spreading a discriminated-union member widens its literal `role`, so TS
  // cannot re-narrow the mapped result back to ModelMessage on its own; the
  // structural identity is preserved.
  return template.map((message): ModelMessage => {
    // A tool message's content is always an array of parts, so it never takes
    // this branch at runtime; excluding it lets TS narrow the union to the
    // members whose content can actually be a string.
    if (message.role !== "tool" && typeof message.content === "string") {
      return {
        ...message,
        content: renderTemplateString(message.content, variablesProxy),
      };
    }
    return message;
  });
}

function renderTemplateString(
  template: string,
  variables: Record<string, unknown>
) {
  // Disable HTML escaping by providing a custom escape function that returns text as-is
  return Mustache.render(template, variables, {}, { escape: (text) => text });
}
