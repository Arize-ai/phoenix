import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { autocompletion, startCompletion } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { closeCompletionOnEscape } from "@phoenix/components/evaluators/completionKeys";
import type { MaterializedEvaluatorContext } from "@phoenix/components/evaluators/evaluatorContext";
import { toEvaluatorCompletionClass } from "@phoenix/components/evaluators/evaluatorContextCompletions";
import { typeaheadTooltips } from "@phoenix/components/filter/typeaheadTooltip";

import { TemplateFormats } from "./constants";
import { getEvaluatorTemplateCompletions } from "./evaluatorTemplateCompletions";
import type { TemplateFormat } from "./types";

/**
 * Finds variables that likely represent arrays/objects that can be iterated.
 * A variable is considered iterable if there are paths with bracket notation
 * or nested properties under it.
 *
 * @internal Exported for testing
 */
export function findIterableVariables(
  allPaths: string[],
  validPaths: string[]
): Set<string> {
  const iterableVars = new Set<string>();

  // Check all paths (including bracket notation) to identify arrays
  for (const path of allPaths) {
    // If path contains bracket notation, the parent is an array
    const bracketMatch = path.match(/^([^[]+)\[/);
    if (bracketMatch) {
      iterableVars.add(bracketMatch[1]);
    }
  }

  // Also consider any variable that has nested paths as potentially iterable
  for (const path of validPaths) {
    const dotIndex = path.indexOf(".");
    if (dotIndex !== -1) {
      iterableVars.add(path.substring(0, dotIndex));
    }
  }

  return iterableVars;
}

/**
 * Detects if the cursor is inside a Mustache section and returns the section variable stack.
 * Sections can be nested, so we track the full stack.
 *
 * @param text - The text before the cursor
 * @returns Array of section variable names we're currently inside (innermost last), or empty if not in a section
 *
 * @internal Exported for testing
 */
export function detectMustacheSectionContext(text: string): string[] {
  const sectionStack: string[] = [];

  // Find all section opens and closes
  // {{#varName}} or {{^varName}} opens a section (with optional whitespace)
  // {{/varName}} closes a section (with optional whitespace)
  // Variable names can contain word characters and hyphens (e.g., my-items, user-data)
  const sectionOpenRegex = /\{\{\s*[#^]\s*([\w-]+(?:\.[\w-]+)*)\s*\}\}/g;
  const sectionCloseRegex = /\{\{\s*\/\s*([\w-]+(?:\.[\w-]+)*)\s*\}\}/g;

  // Track positions of opens and closes
  const events: Array<{
    pos: number;
    type: "open" | "close";
    varName: string;
  }> = [];

  let match;
  while ((match = sectionOpenRegex.exec(text)) !== null) {
    events.push({ pos: match.index, type: "open", varName: match[1] });
  }
  while ((match = sectionCloseRegex.exec(text)) !== null) {
    events.push({ pos: match.index, type: "close", varName: match[1] });
  }

  // Sort by position
  events.sort((a, b) => a.pos - b.pos);

  // Process events to build the current section stack
  for (const event of events) {
    if (event.type === "open") {
      sectionStack.push(event.varName);
    } else if (event.type === "close") {
      // Pop the matching section from the stack
      const idx = sectionStack.lastIndexOf(event.varName);
      if (idx !== -1) {
        sectionStack.splice(idx, 1);
      }
    }
  }

  return sectionStack;
}

/**
 * Gets the child paths available within a section context.
 * When inside {{#items}}...{{/items}}, we want to show paths like "name", "value"
 * instead of "items[0].name", "items[0].value".
 *
 * @param allPaths - All available paths (including bracket notation)
 * @param sectionVar - The section variable we're iterating over
 * @returns Paths available within the section context
 *
 * @internal Exported for testing
 */
export function getPathsForSectionContext(
  allPaths: string[],
  sectionVar: string
): string[] {
  const childPaths = new Set<string>();
  const escapedVar = escapeRegex(sectionVar);

  // Look for paths that start with sectionVar[...] and optionally have more content
  // e.g., "messages[0].role" -> "role", "messages[0].user.name" -> "user", "user.name"
  const bracketPattern = new RegExp(`^${escapedVar}\\[\\d+\\](?:\\.(.+))?$`);

  // Also look for nested object paths like "messages.content" -> "content"
  const dotPattern = new RegExp(`^${escapedVar}\\.(.+)$`);

  for (const path of allPaths) {
    const bracketMatch = path.match(bracketPattern);
    if (bracketMatch) {
      const childPath = bracketMatch[1];
      if (childPath) {
        // Add the child path
        childPaths.add(childPath);
        // Also add intermediate paths (e.g., "user.name" -> also add "user")
        const parts = childPath.split(".");
        for (let i = 1; i < parts.length; i++) {
          childPaths.add(parts.slice(0, i).join("."));
        }
      }
      // Note: if there's no child path (just "messages[0]"), we don't add anything
      // since inside the section, you'd use {{.}} to reference the item itself
    }

    const dotMatch = path.match(dotPattern);
    if (dotMatch) {
      const childPath = dotMatch[1];
      // Filter out bracket notation for Mustache
      if (!childPath.includes("[")) {
        childPaths.add(childPath);
        // Also add intermediate paths
        const parts = childPath.split(".");
        for (let i = 1; i < parts.length; i++) {
          childPaths.add(parts.slice(0, i).join("."));
        }
      }
    }
  }

  return Array.from(childPaths).sort();
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The template variable the cursor sits inside, and where its content starts. */
export type OpenTemplateVariable = { from: number; text: string };

/** Finds the unclosed `{{`/`{` the cursor is writing inside. */
export function findOpenTemplateVariable(
  beforeCursor: string,
  templateFormat: TemplateFormat
): OpenTemplateVariable | null {
  return findTemplateVariableMatch({
    beforeCursor,
    isMustache: templateFormat === TemplateFormats.Mustache,
  });
}

/**
 * Creates an autocomplete extension for template variables.
 *
 * @param availablePaths - Array of available paths for autocomplete (e.g., ["input", "input.query", "reference.label"])
 * @param templateFormat - The template format (Mustache or FString)
 * @param evaluationContext - Materialized evaluator inputs for project evaluators
 * @returns A CodeMirror extension for autocomplete
 */
export function createTemplateAutocomplete(
  availablePaths: string[],
  templateFormat: TemplateFormat,
  evaluationContext: MaterializedEvaluatorContext | null = null
): Extension {
  const completionFn = (context: CompletionContext): CompletionResult | null =>
    templateVariableCompletions(
      context,
      availablePaths,
      templateFormat,
      evaluationContext
    );

  return [
    openEmptyVariableMenu(templateFormat),
    typeaheadTooltips(),
    ...(evaluationContext === null ? [] : [closeCompletionOnEscape]),
    autocompletion({
      override: [completionFn],
      defaultKeymap: true,
      activateOnTyping: true,
      ...(evaluationContext === null
        ? {}
        : {
            icons: false,
            tooltipClass: () => "dsl-filter-typeahead",
            optionClass: toEvaluatorCompletionClass,
          }),
    }),
  ];
}

function openEmptyVariableMenu(templateFormat: TemplateFormat): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.view.hasFocus) return;
    if (!update.selectionSet && !update.docChanged && !update.focusChanged)
      return;
    const cursor = update.state.selection.main;
    if (!cursor.empty) return;
    if (
      !isAtEmptyTemplateVariable({
        beforeCursor: update.state.doc.sliceString(0, cursor.head),
        templateFormat,
      })
    ) {
      return;
    }
    startCompletion(update.view);
  });
}

/** Whether the cursor sits in a variable with nothing typed into it. */
export function isAtEmptyTemplateVariable({
  beforeCursor,
  templateFormat,
}: {
  beforeCursor: string;
  templateFormat: TemplateFormat;
}): boolean {
  return findOpenTemplateVariable(beforeCursor, templateFormat)?.text === "";
}

/**
 * Completion function for template variables.
 *
 * Detects when the cursor is inside a template variable ({{ or {) and provides
 * autocomplete suggestions from the available paths.
 */
function templateVariableCompletions(
  context: CompletionContext,
  availablePaths: string[],
  templateFormat: TemplateFormat,
  evaluationContext: MaterializedEvaluatorContext | null
): CompletionResult | null {
  if (templateFormat === TemplateFormats.NONE) {
    return null;
  }

  const isMustache = templateFormat === TemplateFormats.Mustache;
  const beforeCursor = context.state.doc.sliceString(0, context.pos);
  const match = findOpenTemplateVariable(beforeCursor, templateFormat);
  if (!match) return null;

  if (evaluationContext !== null) {
    return getEvaluatorTemplateCompletions({
      evaluationContext,
      templateFormat,
      variable: match,
      sectionStack: isMustache
        ? detectMustacheSectionContext(beforeCursor)
        : [],
    });
  }

  if (availablePaths.length === 0) return null;

  const typedText = match.text.toLowerCase();
  const { paths, isInSection } = getContextualTemplatePaths({
    availablePaths,
    beforeCursor,
    isMustache,
  });
  const closingBrackets = isMustache ? "}}" : "}";
  const options = paths
    .filter((path) => path.toLowerCase().startsWith(typedText))
    .map((path) => createVariableCompletion({ path, closingBrackets }));

  if (isMustache) {
    appendSectionCompletions({
      options,
      availablePaths,
      contextualPaths: paths,
      typedText,
      isInSection,
    });
  }
  return options.length === 0
    ? null
    : { from: match.from, options, validFor: /^[\w.[\]#^]*$/ };
}

function findTemplateVariableMatch({
  beforeCursor,
  isMustache,
}: {
  beforeCursor: string;
  isMustache: boolean;
}): { from: number; text: string } | null {
  if (isMustache) {
    const openIndex = beforeCursor.lastIndexOf("{{");
    if (openIndex === -1) return null;
    const afterOpen = beforeCursor.slice(openIndex + 2);
    if (afterOpen.includes("}}")) return null;
    const text = afterOpen.trimStart();
    return { from: openIndex + 2 + afterOpen.length - text.length, text };
  }

  for (let index = beforeCursor.length - 1; index >= 0; index--) {
    if (beforeCursor[index] !== "{") continue;
    const isEscaped =
      (index > 0 && beforeCursor[index - 1] === "{") ||
      (index < beforeCursor.length - 1 && beforeCursor[index + 1] === "{");
    if (isEscaped) continue;
    const text = beforeCursor.slice(index + 1);
    return text.includes("}") ? null : { from: index + 1, text };
  }
  return null;
}

function getContextualTemplatePaths({
  availablePaths,
  beforeCursor,
  isMustache,
}: {
  availablePaths: string[];
  beforeCursor: string;
  isMustache: boolean;
}): { paths: string[]; isInSection: boolean } {
  if (!isMustache) return { paths: availablePaths, isInSection: false };
  const fallbackPaths = availablePaths.filter((path) => !path.includes("["));
  const sectionStack = detectMustacheSectionContext(beforeCursor);
  const section = sectionStack[sectionStack.length - 1];
  if (!section) return { paths: fallbackPaths, isInSection: false };
  const sectionPaths = getPathsForSectionContext(
    availablePaths,
    section
  ).filter((path) => !path.includes("["));
  return sectionPaths.length > 0
    ? { paths: sectionPaths, isInSection: true }
    : { paths: fallbackPaths, isInSection: false };
}

function createVariableCompletion({
  path,
  closingBrackets,
}: {
  path: string;
  closingBrackets: string;
}): Completion {
  return {
    label: path,
    type: "variable",
    boost: path.split(".").length === 1 ? 1 : 0,
    apply: (view, _completion, from, to) => {
      const afterCursor = view.state.doc.sliceString(
        to,
        Math.min(to + closingBrackets.length, view.state.doc.length)
      );
      const actualTo =
        afterCursor === closingBrackets ? to + closingBrackets.length : to;
      const insertion = `${path}${closingBrackets}`;
      view.dispatch({
        changes: { from, to: actualTo, insert: insertion },
        selection: { anchor: from + insertion.length },
      });
    },
  };
}

function appendSectionCompletions({
  options,
  availablePaths,
  contextualPaths,
  typedText,
  isInSection,
}: {
  options: Completion[];
  availablePaths: string[];
  contextualPaths: string[];
  typedText: string;
  isInSection: boolean;
}): void {
  const iterableVariables = Array.from(
    findIterableVariables(availablePaths, contextualPaths)
  );
  const sectionPrefix = /^[#^]/.test(typedText) ? typedText[0] : "";
  const searchText = typedText.replace(/^[#^]/, "").toLowerCase();
  const candidates = isInSection
    ? iterableVariables.filter((variable) =>
        contextualPaths.some(
          (path) => path === variable || path.startsWith(`${variable}.`)
        )
      )
    : iterableVariables;

  for (const variable of candidates) {
    if (!variable.toLowerCase().startsWith(searchText)) continue;
    if (!sectionPrefix || sectionPrefix === "#") {
      options.push(createSectionCompletion({ variable, prefix: "#" }));
    }
    if (!sectionPrefix || sectionPrefix === "^") {
      options.push(createSectionCompletion({ variable, prefix: "^" }));
    }
  }
}

function createSectionCompletion({
  variable,
  prefix,
}: {
  variable: string;
  prefix: "#" | "^";
}): Completion {
  const isRegularSection = prefix === "#";
  return {
    label: `${prefix}${variable}`,
    type: "keyword",
    detail: isRegularSection ? "section block" : "inverted section",
    info: isRegularSection
      ? `Iterate over ${variable}`
      : `Show if ${variable} is empty/falsy`,
    apply: (view, _completion, from, to) => {
      const hasClosingBrackets =
        view.state.doc.sliceString(
          to,
          Math.min(to + 2, view.state.doc.length)
        ) === "}}";
      const openTag = `${prefix}${variable}`;
      const insertion = `${openTag}}}{{/${variable}}}`;
      view.dispatch({
        changes: {
          from,
          to: hasClosingBrackets ? to + 2 : to,
          insert: insertion,
        },
        selection: { anchor: from + openTag.length + 2 },
      });
    },
  };
}
