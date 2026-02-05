import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import Mustache from "mustache";

import { parser } from "./mustacheLikeTemplating.syntax.grammar";

/**
 * Defines the language for the Mustache-like templating system
 *
 * @see https://codemirror.net/examples/lang-package/
 *
 * @example
 * ```
 * {{question}}
 *
 * {
 *   "answer": {{answer}}
 * }
 * ```
 * In this example, the variables are `question` and `answer`.
 * Single braces are not considered as variables.
 * Double braces will be interpolated with variable values on format.
 */
export const MustacheLikeTemplatingLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      // https://lezer.codemirror.net/docs/ref/#highlight.styleTags
      styleTags({
        // style the opening brace ({{) of a template, not floating braces
        "Template/LBrace": t.quote,
        // style the closing brace (}}) of a template, not floating braces
        "Template/RBrace": t.quote,
        // style variables (stuff inside {{}})
        "Template/Variable": t.variableName,
        // style invalid stuff, undefined tokens will be highlighted
        "Template/⚠": t.invalid,
      }),
    ],
  }),
  languageData: {},
});

/**
 * Generates a string representation of the parse tree of the given text
 *
 * Useful for debugging the parser
 */
export const debugParser = (text: string) => {
  const tree = MustacheLikeTemplatingLanguage.parser.parse(text);
  return tree.toString();
};

/**
 * Formats a Mustache-like template with the given variables.
 */
export const formatMustacheLike = ({
  text,
  variables,
}: {
  text: string;
  variables: Record<string, string | number | boolean | undefined>;
}) => {
  if (!text) {
    return "";
  }
  try {
    return Mustache.render(text, variables, undefined, {
      escape: (value: string) => value,
    });
  } catch {
    return text;
  }
};

/**
 * Extract the root variable name from a dotted path.
 *
 * Mustache uses dot notation to traverse nested properties (e.g., output.available_tools
 * means context["output"]["available_tools"]). For validation purposes, we only need
 * to check that the root variable exists.
 *
 * @example
 * getRootVariableName("output.available_tools") // => "output"
 * getRootVariableName("user.name") // => "user"
 * getRootVariableName("simple") // => "simple"
 */
const getRootVariableName = (variablePath: string): string => {
  if (variablePath === ".") {
    return variablePath;
  }
  return variablePath.split(".")[0];
};

/**
 * Mustache token types that represent variables we want to extract.
 * - "#" and "^": section/inverted section tags
 * - "name": escaped variable {{name}}
 * - "&" and "{": unescaped variables {{& name}} and {{{name}}}
 */
const VARIABLE_TOKEN_TYPES = new Set(["#", "^", "name", "&", "{"]);

/**
 * Extracts the variables from a Mustache-like template.
 *
 * For dotted paths like {{output.available_tools}}, only the root variable
 * name (output) is extracted, since Mustache traverses nested properties
 * starting from the root.
 *
 * Mustache.parse() returns a flat array of top-level tokens. Nested tokens
 * (inside sections) are encapsulated in the children array of section tokens,
 * so we only need to iterate the top-level array to extract top-level variables.
 */
export const extractVariablesFromMustacheLike = (text: string): string[] => {
  let tokens: ReturnType<typeof Mustache.parse>;
  try {
    tokens = Mustache.parse(text);
  } catch {
    return [];
  }

  const variables = new Set<string>();

  for (const [type, value] of tokens) {
    if (typeof value !== "string") continue;
    if (VARIABLE_TOKEN_TYPES.has(type)) {
      variables.add(getRootVariableName(value.trim()));
    }
  }

  return Array.from(variables);
};

export type MustacheSectionValidation = {
  errors: string[];
  warnings: string[];
};

/**
 * Validates Mustache section tags for proper nesting and closure.
 *
 * Uses the native Mustache.js parser for spec-compliant validation.
 * Parser exceptions are surfaced directly as error messages.
 */
export const validateMustacheSections = (
  text: string
): MustacheSectionValidation => {
  try {
    Mustache.parse(text);
    return { errors: [], warnings: [] };
  } catch (parseError) {
    const message =
      parseError instanceof Error ? parseError.message : "Invalid template";
    return {
      errors: [message],
      warnings: [],
    };
  }
};

/**
 * Creates a CodeMirror extension for the FString templating system
 */
export function MustacheLikeTemplating() {
  return new LanguageSupport(MustacheLikeTemplatingLanguage);
}
