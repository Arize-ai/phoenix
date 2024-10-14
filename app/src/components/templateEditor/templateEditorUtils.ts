import { assertUnreachable } from "@phoenix/typeUtils";

import { extractVariablesFromFString, formatFString } from "./language/fString";
import {
  extractVariablesFromMustacheLike,
  formatMustacheLike,
} from "./language/mustacheLike";
import { TemplateLanguages } from "./constants";
import { TemplateLanguage } from "./types";

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
  format: ({
    text,
    variables,
  }: {
    text: string;
    variables: Record<string, string | number | boolean | undefined>;
  }) => string;
  extractVariables: (template: string) => string[];
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
