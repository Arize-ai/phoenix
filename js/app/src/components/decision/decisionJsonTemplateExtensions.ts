import { jsonParseLinter } from "@codemirror/lang-json";
import { syntaxTree } from "@codemirror/language";
import { linter } from "@codemirror/lint";
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

import { isBareWholeTag } from "./decisionTemplates";

/** The class of a variable tag in a JSON template. */
const DECISION_TAG_CLASS = "cm-decision-tag";

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

/**
 * The variable tags of a JSON template, as decorations: each tag inside a
 * JSON string, or the whole document when it is one bare tag. Object keys
 * are literal.
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
  const tag = Decoration.mark({ class: DECISION_TAG_CLASS });
  const doc = state.doc.toString();
  if (isBareWholeTag({ templateFormat, json: doc })) {
    const from = doc.length - doc.trimStart().length;
    return Decoration.set([tag.range(from, doc.trimEnd().length)]);
  }
  const ranges: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "String") return;
      // Tags are found in the string as written, between its quotes.
      const innerFrom = node.from + 1;
      const inner = doc.slice(innerFrom, node.to - 1);
      parser.parse(inner).iterate({
        enter: (templateNode) => {
          if (templateNode.name !== "Template") return undefined;
          ranges.push(
            tag.range(
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
 * Highlights the variable tags of a JSON template under `templateFormat`
 * in the color template variables take, and lints the JSON, except a
 * state that is one bare tag, which is not JSON but is a valid template.
 * @param params.templateFormat - the playground's template format
 * @param params.variableColor - the color template variables take
 */
export function decisionJsonTemplateExtensions({
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
  const parseLinter = jsonParseLinter();
  const jsonLinter = linter((view) => {
    const doc = view.state.doc.toString();
    if (!doc.trim() || isBareWholeTag({ templateFormat, json: doc })) {
      return [];
    }
    return parseLinter(view);
  });
  const theme = EditorView.theme({
    [`.${DECISION_TAG_CLASS}, .${DECISION_TAG_CLASS} *`]: {
      color: `${variableColor} !important`,
    },
  });
  return [plugin, jsonLinter, theme];
}
