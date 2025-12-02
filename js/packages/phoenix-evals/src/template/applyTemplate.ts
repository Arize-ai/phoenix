import { PromptTemplate, RenderedPrompt } from "../types/templating";

import { createTemplateVariablesProxy } from "./createTemplateVariablesProxy";

import Mustache from "mustache";

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
  return template.map((message) => {
    if (message.content !== undefined && typeof message.content === "string") {
      return {
        ...message,
        content: renderTemplateString(message.content, variablesProxy),
      };
    }
    return message;
  }) as RenderedPrompt;
}

function renderTemplateString(
  template: string,
  variables: Record<string, unknown>
) {
  // Disable HTML escaping by providing a custom escape function that returns text as-is
  return Mustache.render(template, variables, {}, { escape: (text) => text });
}
