import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

import { extractVariables, format } from "../languageUtils";

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
}: Omit<Parameters<typeof format>[0], "parser" | "postFormat">) =>
  format({
    parser: MustacheLikeTemplatingLanguage.parser,
    text,
    variables,
    postFormat: (text) => {
      // replace escaped double braces with double brace
      return text.replaceAll("\\{{", "{{");
    },
  });

/**
 * Extracts the variables from a Mustache-like template
 */
export const extractVariablesFromMustacheLike = (text: string) => {
  const allVariables = extractVariables({
    parser: MustacheLikeTemplatingLanguage.parser,
    text,
  });
  const topLevelVariables: string[] = [];
  let depth = 0;

  for (const variable of allVariables) {
    const trimmed = variable.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("^")) {
      if (depth === 0) {
        topLevelVariables.push(trimmed.slice(1).trim());
      }
      depth += 1;
      continue;
    }
    if (trimmed.startsWith("/")) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) {
      topLevelVariables.push(trimmed);
    }
  }

  return topLevelVariables;
};

/**
 * Creates a CodeMirror extension for the FString templating system
 */
export function MustacheLikeTemplating() {
  return new LanguageSupport(MustacheLikeTemplatingLanguage);
}
