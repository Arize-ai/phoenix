import { assertUnreachable } from "@phoenix/typeUtils";

import { extractVariablesFromFString, formatFString } from "./language/fString";
import {
  extractVariablesFromMustacheLike,
  formatMustacheLike,
} from "./language/mustacheLike";
import { TemplateLanguages } from "./constants";
import { TemplateLanguage } from "./types";

/**
 * A function that formats a template with the given variables
 */
export type FormatFn = (arg: {
  text: string;
  variables: Record<string, string | number | boolean | undefined>;
}) => string;

/**
 * A function that extracts the variables from a template
 */
export type ExtractVariablesFn = (template: string) => string[];

/**
 * Get an object of isomorphic functions for processing templates of the given language
 *
 * @param templateLanguage - The language of the template to process
 *
 * @returns An object containing the `format` and `extractVariables` functions.
 * These functions share the same signature despite the different underlying
 * templating languages.
 */
export const getTemplateLanguageUtils = (
  templateLanguage: TemplateLanguage
): {
  format: FormatFn;
  extractVariables: ExtractVariablesFn;
} => {
  switch (templateLanguage) {
    case TemplateLanguages.FString:
      return {
        format: formatFString,
        extractVariables: extractVariablesFromFString,
      };
    case TemplateLanguages.Mustache:
      return {
        format: formatMustacheLike,
        extractVariables: extractVariablesFromMustacheLike,
      };
    default:
      assertUnreachable(templateLanguage);
  }
};
