import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

import { extractVariables, format } from "../languageUtils";

import { parser } from "./fStringTemplating.syntax.grammar";

/**
 * Define the language for the FString templating system
 *
 * @see https://codemirror.net/examples/lang-package/
 *
 * @example
 * ```
 * {question}
 *
 * {{
 *   "answer": {answer}
 * }}
 * ```
 * In this example, the variables are `question` and `answer`.
 * Double braces are not considered as variables, and will be converted to a single brace on format.
 */
export const FStringTemplatingLanguage = LRLanguage.define({
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
  const tree = FStringTemplatingLanguage.parser.parse(text);
  return tree.toString();
};

/**
 * Formats an FString template with the given variables.
 */
export const formatFString = ({
  text,
  variables,
}: Omit<Parameters<typeof format>[0], "parser" | "postFormat">) =>
  format({
    parser: FStringTemplatingLanguage.parser,
    text,
    variables,
    postFormat: (text) =>
      text.replaceAll("\\{", "{").replaceAll("{{", "{").replaceAll("}}", "}"),
  });

/**
 * Extracts the variables from an FString template
 */
export const extractVariablesFromFString = (text: string) => {
  return extractVariables({
    parser: FStringTemplatingLanguage.parser,
    text,
  });
};

/**
 * Creates a CodeMirror extension for the FString templating system
 */
export function FStringTemplating() {
  return new LanguageSupport(FStringTemplatingLanguage);
}
