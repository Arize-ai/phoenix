import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

import { format } from "../languageUtils";

import { parser } from "./fStringTemplating.syntax.grammar";

// https://codemirror.net/examples/lang-package/
/**
 * Define the language for the FString templating system
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

export function FStringTemplating() {
  return new LanguageSupport(FStringTemplatingLanguage);
}
