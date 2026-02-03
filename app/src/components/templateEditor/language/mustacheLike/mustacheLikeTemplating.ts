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
      escape: (value) => value,
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
 * Extracts the variables from a Mustache-like template.
 *
 * For dotted paths like {{output.available_tools}}, only the root variable
 * name (output) is extracted, since Mustache traverses nested properties
 * starting from the root.
 */
export const extractVariablesFromMustacheLike = (text: string) => {
  let tokens: unknown;
  try {
    tokens = Mustache.parse(text);
  } catch {
    // Fallback: best-effort extraction when native parser fails
    const fallbackVariables = new Set<string>();
    const tagRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
    let depth = 0;
    for (const match of text.matchAll(tagRegex)) {
      const trimmed = match[1]?.trim() ?? "";
      if (
        !trimmed ||
        trimmed.startsWith("!") ||
        trimmed.startsWith(">") ||
        trimmed.startsWith("=") ||
        // Skip malformed triple braces captured as `{name` (the regex captures
        // the inner content of `{{{name}}}` as `{name` due to brace overlap)
        trimmed.startsWith("{")
      ) {
        continue;
      }
      // Skip unescaped variables that start with & (e.g., {{& name}})
      if (trimmed.startsWith("&")) {
        if (depth === 0) {
          const varName = trimmed.slice(1).trim();
          if (varName) {
            fallbackVariables.add(getRootVariableName(varName));
          }
        }
        continue;
      }
      if (trimmed.startsWith("#") || trimmed.startsWith("^")) {
        if (depth === 0) {
          const varName = trimmed.slice(1).trim();
          fallbackVariables.add(getRootVariableName(varName));
        }
        depth += 1;
        continue;
      }
      if (trimmed.startsWith("/")) {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (depth === 0) {
        fallbackVariables.add(getRootVariableName(trimmed));
      }
    }
    return Array.from(fallbackVariables);
  }
  const topLevelVariables = new Set<string>();

  const walkTokens = (tokenList: unknown[], depth: number) => {
    for (const token of tokenList) {
      if (!Array.isArray(token)) {
        continue;
      }
      const [type, value, _start, _end, children] = token;
      if (type === "#" || type === "^") {
        if (depth === 0 && typeof value === "string") {
          topLevelVariables.add(getRootVariableName(value.trim()));
        }
        if (Array.isArray(children)) {
          walkTokens(children, depth + 1);
        }
        continue;
      }
      if ((type === "name" || type === "&" || type === "{") && depth === 0) {
        if (typeof value === "string") {
          topLevelVariables.add(getRootVariableName(value.trim()));
        }
      }
    }
  };

  if (Array.isArray(tokens)) {
    walkTokens(tokens, 0);
  }

  return Array.from(topLevelVariables);
};

export type MustacheSectionValidation = {
  errors: string[];
  warnings: string[];
};

/**
 * Runs a regex-based stack scan to produce descriptive section mismatch errors.
 * This is used as a fallback when the native Mustache parser throws, so we can
 * give users helpful messages like "Missing closing tag for {{#x}} before {{/y}}".
 */
const getDescriptiveSectionErrors = (
  text: string
): MustacheSectionValidation => {
  const tagRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
  const errors: string[] = [];
  const warnings: string[] = [];
  const sectionStack: Array<{ name: string; opener: "#" | "^" }> = [];

  for (const match of text.matchAll(tagRegex)) {
    const trimmed = match[1]?.trim() ?? "";
    if (!trimmed) {
      continue;
    }
    // Skip comments, partials, and delimiter changes
    if (
      trimmed.startsWith("!") ||
      trimmed.startsWith(">") ||
      trimmed.startsWith("=")
    ) {
      continue;
    }
    if (trimmed.startsWith("#") || trimmed.startsWith("^")) {
      const opener = trimmed.startsWith("#") ? "#" : "^";
      sectionStack.push({ name: trimmed.slice(1).trim(), opener });
      continue;
    }
    if (trimmed.startsWith("/")) {
      const closingName = trimmed.slice(1).trim();
      if (sectionStack.length === 0) {
        errors.push(`Unmatched closing tag: {{/${closingName}}}`);
        continue;
      }
      const expectedEntry = sectionStack[sectionStack.length - 1];
      const expectedName = expectedEntry.name;
      if (expectedName !== closingName) {
        const closingIndex = sectionStack
          .map((entry) => entry.name)
          .lastIndexOf(closingName);
        if (closingIndex === -1) {
          errors.push(`Unmatched closing tag: {{/${closingName}}}`);
          continue;
        }
        errors.push(
          `Missing closing tag for {{${expectedEntry.opener}${expectedName}}} ` +
            `before {{/${closingName}}}`
        );
        sectionStack.length = closingIndex;
        continue;
      }
      sectionStack.pop();
    }
  }

  if (errors.length > 0) {
    return { errors, warnings: [] };
  }

  if (sectionStack.length > 0) {
    sectionStack.forEach(({ name, opener }) => {
      warnings.push(`Unclosed section tag: {{${opener}${name}}}`);
    });
  }

  return { errors, warnings };
};

/**
 * Validates Mustache section tags for proper nesting and closure.
 *
 * Uses a native-first approach: tries the native Mustache parser first for
 * spec-consistent validation. If the parser throws, falls back to a regex-based
 * stack scan to produce descriptive error messages about section mismatches.
 */
export const validateMustacheSections = (
  text: string
): MustacheSectionValidation => {
  // Try native parser first for spec-consistent validation
  try {
    Mustache.parse(text);
    // If parse succeeds, the template is valid
    return { errors: [], warnings: [] };
  } catch (parseError) {
    // Native parser failed - run descriptive fallback for section errors
    const descriptiveResult = getDescriptiveSectionErrors(text);

    // If we found descriptive section errors, return those
    if (
      descriptiveResult.errors.length > 0 ||
      descriptiveResult.warnings.length > 0
    ) {
      return descriptiveResult;
    }

    // No section errors found, but parse still failed - return generic error
    const message =
      parseError instanceof Error ? `: ${parseError.message}` : "";
    return {
      errors: [`Invalid mustache template${message}`],
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
