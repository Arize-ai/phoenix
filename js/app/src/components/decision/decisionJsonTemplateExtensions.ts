import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { LRParser } from "@lezer/lr";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { FStringTemplatingLanguage } from "@phoenix/components/templateEditor/language/fString";
import { MustacheLikeTemplatingLanguage } from "@phoenix/components/templateEditor/language/mustacheLike";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";

import { getWholeTagPath } from "./decisionTemplateRendering";

/** The class of a string that is exactly one tag: a typed hole. */
export const DECISION_HOLE_CLASS = "cm-decision-hole";
/** The class of a tag inside a longer string, rendered as text. */
export const DECISION_TAG_CLASS = "cm-decision-tag";

type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]>;

const JSON_VALUE_NODES = new Set([
  "Object",
  "Array",
  "String",
  "Number",
  "True",
  "False",
  "Null",
]);

function getTemplateParser(templateFormat: TemplateFormat): LRParser | null {
  switch (templateFormat) {
    case TemplateFormats.Mustache:
      return MustacheLikeTemplatingLanguage.parser;
    case TemplateFormats.FString:
      return FStringTemplatingLanguage.parser;
    default:
      return null;
  }
}

function decodeJsonString(text: string): string | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

/**
 * The tags in each JSON string of a document, as decorations: a string that
 * is exactly one tag is marked as a hole, with the path it reads; a tag
 * inside a longer string is marked as a tag. Object keys are literal.
 */
function buildDecorations({
  state,
  templateFormat,
}: {
  state: EditorState;
  templateFormat: TemplateFormat;
}): DecorationSet {
  const parser = getTemplateParser(templateFormat);
  if (!parser) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "String") return;
      const raw = state.doc.sliceString(node.from, node.to);
      const decoded = decodeJsonString(raw);
      const path =
        decoded != null
          ? getWholeTagPath({ templateFormat, text: decoded })
          : null;
      if (path != null) {
        ranges.push(
          Decoration.mark({
            class: DECISION_HOLE_CLASS,
            attributes: {
              title: `Hole: the value of ${path}, sent with its JSON type`,
            },
          }).range(node.from, node.to)
        );
        return;
      }
      // Tags are found in the string as written, between its quotes.
      const innerFrom = node.from + 1;
      const inner = raw.slice(1, -1);
      parser.parse(inner).iterate({
        enter: (templateNode) => {
          if (templateNode.name !== "Template") return undefined;
          ranges.push(
            Decoration.mark({ class: DECISION_TAG_CLASS }).range(
              innerFrom + templateNode.from,
              innerFrom + templateNode.to
            )
          );
          return false;
        },
      });
    },
  });
  return Decoration.set(ranges, true);
}

/**
 * Highlights variable tags inside the strings of a JSON template under
 * `templateFormat`, drawing a string that is exactly one tag as a typed
 * hole, distinct from a tag inside a longer string.
 * @param params.templateFormat - the playground's template format
 * @param params.variableColor - the color template variables take
 */
export function decisionJsonTemplateHighlighting({
  templateFormat,
  variableColor,
}: {
  templateFormat: TemplateFormat;
  variableColor: string;
}) {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations({
          state: view.state,
          templateFormat,
        });
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = buildDecorations({
            state: update.state,
            templateFormat,
          });
        }
      }
    },
    { decorations: (value) => value.decorations }
  );
  const theme = EditorView.theme({
    [`.${DECISION_TAG_CLASS}, .${DECISION_TAG_CLASS} *`]: {
      color: `${variableColor} !important`,
    },
    [`.${DECISION_HOLE_CLASS}`]: {
      borderRadius: "var(--global-rounding-small)",
      backgroundColor: `color-mix(in srgb, ${variableColor} 16%, transparent)`,
      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${variableColor} 45%, transparent)`,
      padding: "0 1px",
    },
    [`.${DECISION_HOLE_CLASS}, .${DECISION_HOLE_CLASS} *`]: {
      color: `${variableColor} !important`,
      fontWeight: "600",
    },
  });
  return [plugin, theme];
}

/** A JSON value picked by a selection, to become a variable. */
export type JsonValueSelection = {
  /** The range that becomes the tag. */
  from: number;
  to: number;
  /**
   * `value`: the whole value becomes a hole. `text`: part of a string
   * becomes a tag inside it.
   */
  kind: "value" | "text";
  /** The value's JSON type, for `value`. */
  nodeName: string;
  /** The value as written: JSON source for `value`, the string's text for `text`. */
  source: string;
  /** The name of the property the value belongs to, if any. */
  propertyName: string | null;
};

function getPropertyName({
  node,
  state,
}: {
  node: SyntaxNode;
  state: EditorState;
}): string | null {
  for (
    let current: SyntaxNode | null = node;
    current;
    current = current.parent
  ) {
    if (current.name !== "Property") continue;
    const nameNode = current.getChild("PropertyName");
    if (!nameNode) return null;
    return decodeJsonString(state.doc.sliceString(nameNode.from, nameNode.to));
  }
  return null;
}

/**
 * The JSON value a selection picks, found in the editor's syntax tree: the
 * smallest value that holds the selection (a selected property name picks
 * its value), or the selected part of a string's text. Null when the
 * selection is empty or picks no value.
 */
export function findJsonValueSelection({
  state,
  from,
  to,
}: {
  state: EditorState;
  from: number;
  to: number;
}): JsonValueSelection | null {
  if (from === to) return null;
  const tree = syntaxTree(state);
  let node: SyntaxNode | null = tree.resolveInner(from, 1);
  // A property name picks the property's value.
  for (
    let current: SyntaxNode | null = node;
    current;
    current = current.parent
  ) {
    if (current.name === "PropertyName" && current.to >= to) {
      const property = current.parent;
      const value = property?.lastChild;
      if (value && JSON_VALUE_NODES.has(value.name)) node = value;
      break;
    }
  }
  while (
    node &&
    !(JSON_VALUE_NODES.has(node.name) && node.from <= from && node.to >= to)
  ) {
    node = node.parent;
  }
  if (!node) return null;
  const propertyName = getPropertyName({ node, state });
  // Part of a string's text becomes a tag inside the string.
  if (node.name === "String" && from > node.from && to < node.to) {
    const isWholeText = from === node.from + 1 && to === node.to - 1;
    if (!isWholeText) {
      return {
        from,
        to,
        kind: "text",
        nodeName: node.name,
        source:
          decodeJsonString(`"${state.doc.sliceString(from, to)}"`) ??
          state.doc.sliceString(from, to),
        propertyName,
      };
    }
  }
  return {
    from: node.from,
    to: node.to,
    kind: "value",
    nodeName: node.name,
    source: state.doc.sliceString(node.from, node.to),
    propertyName,
  };
}
