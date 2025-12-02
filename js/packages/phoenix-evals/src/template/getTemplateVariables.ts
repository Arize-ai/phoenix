import { PromptTemplate } from "../types/templating";

import Mustache from "mustache";

type GetTemplateVariableArgs = {
  template: PromptTemplate;
};
/**
 * Parse out the template variables of a prompt
 * @param {GetTemplateVariableArgs} args
 * @returns {string[]} a list of prompt template variables
 */
export function getTemplateVariables(args: GetTemplateVariableArgs): string[] {
  const { template } = args;
  if (typeof template === "string") {
    return getTemplateVariablesFromString(template);
  }
  return template.reduce((acc, message) => {
    if (message.content !== undefined && typeof message.content === "string") {
      return [...acc, ...getTemplateVariablesFromString(message.content)];
    }
    return acc;
  }, [] as string[]);
}
/**
 * Parse out the template variables of a string template
 * @param template - The template to get the variables from
 * @returns {string[]} a list of prompt template variables
 */
function getTemplateVariablesFromString(template: string): string[] {
  const templateSpans = Mustache.parse(template);
  return templateSpans.reduce((acc, templateSpan) => {
    const [spanType, value] = templateSpan;
    if (spanType === "name" && typeof value === "string") {
      acc = [...acc, value];
    }
    return acc;
  }, [] as string[]);
}
