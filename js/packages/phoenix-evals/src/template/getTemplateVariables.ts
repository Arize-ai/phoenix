import { Template } from "../types/templating";
import Mustache from "mustache";

type GetTemplateVariableArgs = {
  template: Template;
};
/**
 * Parse out the template variables of a prompt
 * @param {GetTemplateVariableArgs} args
 * @returns {string[]} a list of prompt template variables
 */
export function getTemplateVariables(args: GetTemplateVariableArgs) {
  const { template } = args;
  const templateSpans = Mustache.parse(template);
  return templateSpans.entries().reduce((acc, entry) => {
    const [, templateSpan] = entry;
    const [spanType, value] = templateSpan;
    if (spanType === "name" && typeof value === "string") {
      acc = [...acc, value];
    }
    return acc;
  }, [] as string[]);
}
