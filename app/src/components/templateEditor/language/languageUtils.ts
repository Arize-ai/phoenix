import { LRParser } from "@lezer/lr";

/**
 * Extracts all variables from a templated string.
 *
 * @returns An array of variable names.
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
   *
   * If a variable is not found in this object, it will be left as is.
   */
  variables: Record<string, string | number | boolean | undefined>;
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
      const variable = result.slice(cur.node.from, cur.node.to).trim();
      // grab the position of the content including the braces
      const Template = cur.node.parent!;
      if (variable in variables) {
        // replace the content (including braces and whitespace) with the variable value
        result = `${result.slice(0, Template.from)}${variables[variable]}${result.slice(Template.to)}`;
        // reparse the result so that positions are updated
        tree = parser.parse(result);
        // reset the cursor to the start of the new tree
        cur = tree.cursor();
      }
    }
  } while (cur.next());
  if (postFormat) {
    result = postFormat(result);
  }
  return result;
};
