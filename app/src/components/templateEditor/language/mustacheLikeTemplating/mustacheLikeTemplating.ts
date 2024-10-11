import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

import { parser } from "./mustacheLikeTemplating.syntax.grammar";

// https://codemirror.net/examples/lang-package/
/**
 * Defines the language for the Mustache-like templating system
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

export const debugParser = (text: string) => {
  const tree = MustacheLikeTemplatingLanguage.parser.parse(text);
  // eslint-disable-next-line no-console
  console.log(tree.toString());
};

export const extractVariables = (text: string) => {
  const tree = MustacheLikeTemplatingLanguage.parser.parse(text);
  const variables: string[] = [];
  const cur = tree.cursor();
  do {
    // eslint-disable-next-line no-console
    if (cur.name === "Variable") {
      variables.push(text.slice(cur.node.from, cur.node.to));
    }
  } while (cur.next());
  return variables;
};

export const format = ({
  text,
  variables,
}: {
  text: string;
  variables: Record<string, string>;
}) => {
  if (!text) return "";
  let result = text;
  let tree = MustacheLikeTemplatingLanguage.parser.parse(result);
  let cur = tree.cursor();
  do {
    if (cur.name === "Variable") {
      // grab the content inside of the braces
      const variable = result.slice(cur.node.from, cur.node.to);
      // grab the position of the content including the braces
      const Template = cur.node.parent!;
      if (variable in variables) {
        // replace the content (including braces) with the variable value
        result = `${result.slice(0, Template.from)}${variables[variable]}${result.slice(Template.to)}`;
        // reparse the result so that positions are updated
        tree = MustacheLikeTemplatingLanguage.parser.parse(result);
        // reset the cursor to the start of the new tree
        cur = tree.cursor();
      }
    }
  } while (cur.next());
  return result;
};

export function MustacheLikeTemplating() {
  return new LanguageSupport(MustacheLikeTemplatingLanguage);
}
