import { assertUnreachable } from "@phoenix/typeUtils";

import { extractVariablesFromFString, formatFString } from "./language/fString";
import {
  extractVariablesFromJSONPath,
  formatJSONPath,
} from "./language/jsonPath";
import {
  extractVariablesFromMustacheLike,
  formatMustacheLike,
} from "./language/mustacheLike";
import { TemplateFormats } from "./constants";
import { TemplateFormat } from "./types";

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
 * @param templateFormat - The format of the template to process
 *
 * @returns An object containing the `format` and `extractVariables` functions.
 * These functions share the same signature despite the different underlying
 * templating languages.
 */
export const getTemplateFormatUtils = (
  templateFormat: TemplateFormat
): {
  format: FormatFn;
  extractVariables: ExtractVariablesFn;
} => {
  switch (templateFormat) {
    case TemplateFormats.FString:
      return {
        format: formatFString,
        extractVariables: extractVariablesFromFString,
      };
    case TemplateFormats.Mustache:
      return {
        format: formatMustacheLike,
        extractVariables: extractVariablesFromMustacheLike,
      };
    case TemplateFormats.JSONPath:
      return {
        format: formatJSONPath,
        extractVariables: extractVariablesFromJSONPath,
      };
    case TemplateFormats.NONE:
      return {
        format: ({ text }) => text,
        extractVariables: () => [],
      };
    default:
      assertUnreachable(templateFormat);
  }
};
