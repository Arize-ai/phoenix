import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

import { extractVariables, format } from "../languageUtils";

import { parser } from "./jsonPathTemplating.syntax.grammar";

/**
 * Define the language for the JSON_PATH templating system
 *
 * @see https://codemirror.net/examples/lang-package/
 *
 * @example
 * ```
 * {$.question}
 *
 * {
 *   "answer": {$.answer}
 * }
 * ```
 * In this example, the variables are `$.question` and `$.answer`.
 * Escaped braces `\{` are not considered as variables.
 */
export const JSONPathTemplatingLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      // https://lezer.codemirror.net/docs/ref/#highlight.styleTags
      styleTags({
        // style the opening brace of a template, not floating braces
        "Template/LBrace": t.quote,
        // style the closing brace of a template, not floating braces
        "Template/RBrace": t.quote,
        // style variables (stuff inside {})
        "Template/Variable": t.variableName,
        // style invalid stuff, undefined tokens will be highlighted
        "⚠": t.invalid,
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
  const tree = JSONPathTemplatingLanguage.parser.parse(text);
  return tree.toString();
};

/**
 * Formats a JSON_PATH template with the given variables.
 */
export const formatJSONPath = ({
  text,
  variables,
}: Omit<Parameters<typeof format>[0], "parser" | "postFormat">) =>
  format({
    parser: JSONPathTemplatingLanguage.parser,
    text,
    variables,
    postFormat: (text) =>
      // replace escaped braces with braces
      text.replaceAll("\\{", "{"),
  });

/**
 * Extracts the variables from a JSON_PATH template
 */
export const extractVariablesFromJSONPath = (text: string) => {
  return extractVariables({
    parser: JSONPathTemplatingLanguage.parser,
    text,
  });
};

/**
 * Creates a CodeMirror extension for the JSON_PATH templating system
 */
export function JSONPathTemplating() {
  return new LanguageSupport(JSONPathTemplatingLanguage);
}
