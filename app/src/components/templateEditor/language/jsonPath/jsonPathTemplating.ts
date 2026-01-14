import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";

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
 * Options for path autocomplete
 */
export type PathAutocompleteOption = {
  id: string;
  label: string;
};

/**
 * Creates an autocomplete function for JSON path suggestions
 */
function createJSONPathAutocomplete(
  pathOptions: PathAutocompleteOption[]
): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext): CompletionResult | null => {
    // Check if we're inside a template variable (between { and })
    const textBefore = context.state.doc.sliceString(0, context.pos);
    const lastOpenBrace = textBefore.lastIndexOf("{");
    const lastCloseBrace = textBefore.lastIndexOf("}");

    // Only autocomplete if we're inside braces and after the opening brace
    if (lastOpenBrace === -1 || lastCloseBrace > lastOpenBrace) {
      return null;
    }

    // Extract the text after the opening brace
    const textAfterBrace = textBefore.slice(lastOpenBrace + 1);

    // Match the current word being typed (starting with $ and including dots and brackets)
    const word =
      context.matchBefore(/\$[\w.\[\]]*/) || context.matchBefore(/\w*/);
    if (!word) return null;

    // Don't autocomplete if cursor is not at the end of the word and not explicit
    if (word.from == word.to && !context.explicit) return null;

    return {
      from: word.from,
      options: pathOptions.map((option) => ({
        label: option.label,
        type: "variable",
        apply: option.id,
      })),
    };
  };
}

/**
 * Creates a CodeMirror extension for the JSON_PATH templating system
 * @param options - Optional configuration
 * @param options.pathOptions - Autocomplete suggestions for JSON paths
 */
export function JSONPathTemplating(options?: {
  pathOptions?: PathAutocompleteOption[];
}) {
  const extensions = [];

  // Add autocomplete if path options are provided
  if (options?.pathOptions && options.pathOptions.length > 0) {
    extensions.push(
      autocompletion({
        override: [createJSONPathAutocomplete(options.pathOptions)],
      })
    );
  }

  return new LanguageSupport(JSONPathTemplatingLanguage, extensions);
}
