import { LRParser } from "@lezer/lr";

import { getRootKey, getValueAtPath } from "@phoenix/utils/objectUtils";

/**
 * Extracts all variables from a templated string.
 *
 * @returns An array of variable names (may include dot notation paths like "input.query" or "messages[0].content").
 */
export const extractVariables = ({
  parser,
  text,
}: {
  /**
   * The parser for the templating language.
   *  The parser should be a language parser that emits Variable nodes.
   */
  parser: LRParser;
  /**
   * The text to extract variables from.
   */
  text: string;
}) => {
  const tree = parser.parse(text);
  const variables: string[] = [];
  const cur = tree.cursor();
  do {
    if (cur.name === "Variable") {
      const variable = text.slice(cur.node.from, cur.node.to).trim();
      variables.push(variable);
    }
  } while (cur.next());
  return variables;
};

/**
 * Formats a templated string with the given variables.
 *
 * The parser should be a language parser that emits Variable nodes as children of some parent node.
 * Supports dot notation and array indexing in variable names (e.g., "input.messages[0].content").
 */
export const format = ({
  parser,
  text,
  variables,
  postFormat,
}: {
  /**
   * The parser for the templating language.
   *
   * Should be MustacheLikeTemplatingLanguage or FStringTemplatingLanguage.
   *
   * format assumes that the language produces a structure where Variable nodes
   * are children of some parent node, in this case Template.
   */
  parser: LRParser;
  /**
   * The text to format.
   */
  text: string;
  /**
   * A mapping of variable names to their values.
   * Can be a nested object - paths like "input.query" will be resolved.
   *
   * If a variable path cannot be resolved, the template placeholder will be left as is.
   */
  variables: Record<string, unknown>;
  /**
   * Runs after formatting the text but just before returning the result
   *
   * Useful for doing post-parse processing, like replacing double braces with single braces,
   * or trimming whitespace.
   */
  postFormat?: (text: string) => string;
}) => {
  if (!text) return "";
  let result = text;
  let tree = parser.parse(result);
  let cur = tree.cursor();
  do {
    if (cur.name === "Variable") {
      // grab the content inside of the braces, ignoring whitespace
      const variablePath = result.slice(cur.node.from, cur.node.to).trim();
      // grab the position of the content including the braces
      const Template = cur.node.parent!;

      // Check if the root key exists in variables
      const rootKey = getRootKey(variablePath);
      if (rootKey in variables) {
        // Use getValueAtPath to resolve the full path (supports dot notation and array indexing)
        const value = getValueAtPath(variables, variablePath);
        if (value !== undefined) {
          // replace the content (including braces and whitespace) with the variable value
          const replacement = typeof value === "string" ? value : String(value);
          result = `${result.slice(0, Template.from)}${replacement}${result.slice(Template.to)}`;
          // reparse the result so that positions are updated
          tree = parser.parse(result);
          // reset the cursor to the start of the new tree
          cur = tree.cursor();
        }
      }
    }
  } while (cur.next());
  if (postFormat) {
    result = postFormat(result);
  }
  return result;
};
