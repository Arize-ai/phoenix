import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

import { parser } from "./fStringTemplating.syntax.grammar";

// https://codemirror.net/examples/lang-package/
export const FStringTemplatingLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      // https://lezer.codemirror.net/docs/ref/#highlight.styleTags
      styleTags({
        // style the opening brace of a template, not floating braces
        "Template/{": t.quote,
        // style the closing brace of a template, not floating braces
        "Template/}": t.quote,
        // style variables (stuff inside {})
        "Template/Variable": t.variableName,
        // style invalid stuff, undefined tokens will be highlighted
        "Template/⚠": t.invalid,
      }),
    ],
  }),
  languageData: {},
});

export const debugParser = (text: string) => {
  const tree = FStringTemplatingLanguage.parser.parse(text);
  // eslint-disable-next-line no-console
  console.log(tree.toString());
};

export const extractVariables = (text: string) => {
  const tree = FStringTemplatingLanguage.parser.parse(text);
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

export function FStringTemplating() {
  return new LanguageSupport(FStringTemplatingLanguage);
}
