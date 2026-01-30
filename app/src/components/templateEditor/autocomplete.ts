import {
  autocompletion,
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { Extension } from "@codemirror/state";
import { EditorView } from "@uiw/react-codemirror";

import { TemplateFormats } from "./constants";
import { TemplateFormat } from "./types";

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
  // {{#varName}} or {{^varName}} opens a section
  // {{/varName}} closes a section
  const sectionOpenRegex = /\{\{[#^](\w+(?:\.\w+)*)\}\}/g;
  const sectionCloseRegex = /\{\{\/(\w+(?:\.\w+)*)\}\}/g;

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

/**
 * Creates an autocomplete extension for template variables.
 *
 * @param availablePaths - Array of available paths for autocomplete (e.g., ["input", "input.query", "reference.label"])
 * @param templateFormat - The template format (Mustache or FString)
 * @returns A CodeMirror extension for autocomplete
 */
export function createTemplateAutocomplete(
  availablePaths: string[],
  templateFormat: TemplateFormat
): Extension {
  const completionFn = (context: CompletionContext): CompletionResult | null =>
    templateVariableCompletions(context, availablePaths, templateFormat);

  return autocompletion({
    override: [completionFn],
    defaultKeymap: true,
    activateOnTyping: true,
  });
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
  templateFormat: TemplateFormat
): CompletionResult | null {
  if (availablePaths.length === 0) {
    return null;
  }

  // Determine the template syntax based on format
  const isMustache = templateFormat === TemplateFormats.Mustache;

  // Match the content before the cursor
  // For Mustache: match after {{ and any content
  // For FString: match after { and any content (but not {{)
  const beforeCursor = context.state.doc.sliceString(0, context.pos);

  let match: { from: number; text: string } | null = null;

  if (isMustache) {
    // For Mustache, find the last {{ that's not closed
    const lastOpenIndex = beforeCursor.lastIndexOf("{{");
    if (lastOpenIndex !== -1) {
      const afterOpen = beforeCursor.slice(lastOpenIndex + 2);
      // Check if there's a closing }} after the {{
      if (!afterOpen.includes("}}")) {
        // Extract the variable content so far (may include #, ^, / for sections)
        const varContent = afterOpen.trimStart();
        match = {
          from:
            lastOpenIndex +
            2 +
            (afterOpen.length - afterOpen.trimStart().length),
          text: varContent,
        };
      }
    }
  } else {
    // For FString, find the last { that's not doubled and not closed
    // We need to find a single { not preceded by another { and not followed by {
    for (let i = beforeCursor.length - 1; i >= 0; i--) {
      if (beforeCursor[i] === "{") {
        // Check if it's a doubled brace (escape)
        const isEscaped =
          (i > 0 && beforeCursor[i - 1] === "{") ||
          (i < beforeCursor.length - 1 && beforeCursor[i + 1] === "{");
        if (!isEscaped) {
          const afterOpen = beforeCursor.slice(i + 1);
          // Check if there's a closing } after the {
          if (!afterOpen.includes("}")) {
            match = {
              from: i + 1,
              text: afterOpen,
            };
          }
          break;
        }
      }
    }
  }

  if (!match) {
    return null;
  }

  // Filter available paths based on what's already typed
  const typedText = match.text.toLowerCase();

  // For Mustache, detect if we're inside a section block
  let contextualPaths: string[];
  let inSectionContext = false;

  // Default paths without bracket notation (for Mustache outside sections)
  const nonBracketPaths = availablePaths.filter((path) => !path.includes("["));

  if (isMustache) {
    const sectionStack = detectMustacheSectionContext(beforeCursor);

    if (sectionStack.length > 0) {
      // We're inside a section - show only child paths of the innermost section
      const innermostSection = sectionStack[sectionStack.length - 1];
      const sectionPaths = getPathsForSectionContext(
        availablePaths,
        innermostSection
      );

      // If we found section-specific paths, use them; otherwise fall back to regular paths
      if (sectionPaths.length > 0) {
        contextualPaths = sectionPaths;
        inSectionContext = true;
      } else {
        // Section variable doesn't match any known paths - fall back to regular paths
        // This helps when the section variable is invalid or the array is empty
        contextualPaths = nonBracketPaths;
      }
    } else {
      // Not in a section - show top-level paths (without bracket notation)
      contextualPaths = nonBracketPaths;
    }
  } else {
    // F-string: show all paths
    contextualPaths = availablePaths;
  }

  // Determine the closing bracket pattern based on template format
  const closingBrackets = isMustache ? "}}" : "}";
  const closingBracketLength = closingBrackets.length;

  const options: Completion[] = contextualPaths
    .filter((path) => path.toLowerCase().startsWith(typedText))
    .map((path) => ({
      label: path,
      type: "variable",
      boost: path.split(".").length === 1 ? 1 : 0, // Boost top-level variables
      apply: (
        view: EditorView,
        completion: Completion,
        from: number,
        to: number
      ) => {
        // Check if closing brackets already exist after the cursor
        const docLength = view.state.doc.length;
        const afterCursor = view.state.doc.sliceString(
          to,
          Math.min(to + closingBracketLength, docLength)
        );
        const hasClosingBrackets = afterCursor === closingBrackets;

        // If closing brackets exist, extend replacement to include them, then add them back
        // If not, just add the closing brackets
        const actualTo = hasClosingBrackets ? to + closingBracketLength : to;
        const insertion = `${path}${closingBrackets}`;

        view.dispatch({
          changes: { from, to: actualTo, insert: insertion },
          // Position cursor after the closing brackets
          selection: { anchor: from + insertion.length },
        });
      },
    }));

  // For Mustache, suggest section syntax for iterable variables (only when not already in a section for that var)
  if (isMustache) {
    const iterableVars = findIterableVariables(availablePaths, contextualPaths);

    // Find variables that match what's been typed (for section suggestions)
    const matchingVars = Array.from(iterableVars).filter((varName) =>
      varName.toLowerCase().startsWith(typedText.replace(/^[#^]/, ""))
    );

    // Check if user is typing a section (starts with # or ^)
    const isTypingSection =
      typedText.startsWith("#") || typedText.startsWith("^");
    const sectionPrefix = isTypingSection ? typedText[0] : "";
    const searchText = isTypingSection
      ? typedText.slice(1).toLowerCase()
      : typedText.toLowerCase();

    // Only suggest sections for contextual paths (not full paths when in a section)
    const sectionCandidates = inSectionContext
      ? Array.from(iterableVars).filter((v) =>
          contextualPaths.some((p) => p === v || p.startsWith(v + "."))
        )
      : matchingVars;

    for (const varName of sectionCandidates) {
      if (!varName.toLowerCase().startsWith(searchText)) continue;

      // Section block ({{#var}}...{{/var}})
      if (!sectionPrefix || sectionPrefix === "#") {
        options.push({
          label: `#${varName}`,
          type: "keyword",
          detail: "section block",
          info: `Iterate over ${varName}`,
          apply: (
            view: EditorView,
            completion: Completion,
            from: number,
            to: number
          ) => {
            // Check if there's already a }} after the cursor (from auto-bracket)
            const docLength = view.state.doc.length;
            const afterCursor = view.state.doc.sliceString(
              to,
              Math.min(to + 2, docLength)
            );
            const hasClosingBrackets = afterCursor === "}}";

            // If closing brackets exist, extend replacement range to include them
            const actualTo = hasClosingBrackets ? to + 2 : to;

            // Build the insertion - the insertion template adds }} after openTag
            const openTag = `#${varName}`;
            const closeTag = `{{/${varName}}}`;
            const insertion = `${openTag}}}${closeTag}`;
            const cursorPos = from + openTag.length + 2; // Position after the opening tag's }}

            view.dispatch({
              changes: { from, to: actualTo, insert: insertion },
              selection: { anchor: cursorPos },
            });
          },
        });
      }

      // Inverted section ({{^var}}...{{/var}})
      if (!sectionPrefix || sectionPrefix === "^") {
        options.push({
          label: `^${varName}`,
          type: "keyword",
          detail: "inverted section",
          info: `Show if ${varName} is empty/falsy`,
          apply: (
            view: EditorView,
            completion: Completion,
            from: number,
            to: number
          ) => {
            // Check if there's already a }} after the cursor (from auto-bracket)
            const docLength = view.state.doc.length;
            const afterCursor = view.state.doc.sliceString(
              to,
              Math.min(to + 2, docLength)
            );
            const hasClosingBrackets = afterCursor === "}}";

            // If closing brackets exist, extend replacement range to include them
            const actualTo = hasClosingBrackets ? to + 2 : to;

            // Build the insertion - the insertion template adds }} after openTag
            const openTag = `^${varName}`;
            const closeTag = `{{/${varName}}}`;
            const insertion = `${openTag}}}${closeTag}`;
            const cursorPos = from + openTag.length + 2; // Position after the opening tag's }}

            view.dispatch({
              changes: { from, to: actualTo, insert: insertion },
              selection: { anchor: cursorPos },
            });
          },
        });
      }
    }
  }

  if (options.length === 0) {
    return null;
  }

  return {
    from: match.from,
    options,
    validFor: /^[\w.[\]#^]*$/,
  };
}
