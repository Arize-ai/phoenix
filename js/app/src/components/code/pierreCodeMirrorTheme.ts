/**
 * CodeMirror themes derived from the Pierre theme (`@pierre/theme`).
 *
 * This is the same theme source used to render diffs (via `@pierre/diffs`), so
 * code blocks and diffs share a consistent light/dark appearance across the app.
 *
 * The Pierre theme ships as a VS Code / TextMate theme (editor `colors` plus
 * scope-based `tokenColors`). Here we translate it into a CodeMirror theme by
 * mapping the editor colors onto CodeMirror's editor settings and a curated set
 * of TextMate scopes onto Lezer highlight tags.
 */
import { tags as t } from "@lezer/highlight";
import pierreDarkTheme from "@pierre/theme/pierre-dark";
import pierreLightTheme from "@pierre/theme/pierre-light";
import { createTheme, type CreateThemeOptions } from "@uiw/codemirror-themes";

type PierreTheme = typeof pierreLightTheme;

/**
 * Find the foreground color a Pierre theme assigns to a given TextMate scope.
 */
function scopeColor(theme: PierreTheme, scope: string): string | undefined {
  for (const token of theme.tokenColors) {
    const scopes = Array.isArray(token.scope)
      ? token.scope
      : token.scope
        ? [token.scope]
        : [];
    if (scopes.includes(scope)) {
      return token.settings.foreground;
    }
  }
  return undefined;
}

function createPierreTheme(theme: PierreTheme) {
  const colors = theme.colors;
  const color = (scope: string) => scopeColor(theme, scope);

  const styles: CreateThemeOptions["styles"] = [
    {
      tag: [t.standard(t.tagName), t.tagName],
      color: color("entity.name.tag"),
    },
    { tag: [t.comment], color: color("comment") },
    {
      tag: [t.bracket, t.punctuation, t.separator, t.derefOperator],
      color: color("punctuation"),
    },
    {
      tag: [t.className, t.typeName, t.namespace, t.definition(t.typeName)],
      color: color("entity.name.type"),
    },
    {
      tag: [t.propertyName, t.attributeName],
      color: color("entity.other.attribute-name"),
    },
    {
      tag: [
        t.function(t.variableName),
        t.function(t.propertyName),
        t.macroName,
      ],
      color: color("entity.name.function"),
    },
    {
      tag: [t.variableName, t.definition(t.variableName)],
      color: color("variable"),
    },
    {
      tag: [t.number, t.bool, t.atom],
      color: color("constant.numeric"),
    },
    {
      tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword],
      color: color("keyword"),
    },
    {
      tag: [t.string, t.special(t.string), t.docString],
      color: color("string"),
    },
    { tag: [t.operator], color: color("keyword.operator") },
    {
      tag: [t.constant(t.variableName), t.literal],
      color: color("constant"),
    },
    { tag: [t.regexp], color: color("string.regexp") },
    { tag: [t.escape], color: color("constant.character.escape") },
    {
      tag: [t.heading, t.strong],
      color: color("markup.heading"),
      fontWeight: "bold",
    },
    { tag: [t.emphasis], fontStyle: "italic" },
    {
      tag: [t.link, t.url],
      color: color("markup.underline.link.markdown"),
      textDecoration: "underline",
    },
    { tag: [t.strikethrough], textDecoration: "line-through" },
    { tag: [t.invalid], color: colors["editor.foreground"] },
  ];

  return createTheme({
    theme: theme.type,
    settings: {
      background: colors["editor.background"],
      foreground: colors["editor.foreground"],
      caret: colors["editorCursor.foreground"],
      selection: colors["editor.selectionBackground"],
      selectionMatch: colors["editor.selectionBackground"],
      lineHighlight: colors["editor.lineHighlightBackground"],
      gutterBackground: colors["editor.background"],
      gutterForeground: colors["editorLineNumber.foreground"],
      gutterActiveForeground: colors["editorLineNumber.activeForeground"],
    },
    // Drop entries whose scope is absent from the theme so we never emit a
    // tag style without a color or other styling.
    styles: styles.filter(
      (style) =>
        style.color != null ||
        style.fontWeight != null ||
        style.fontStyle != null ||
        style.textDecoration != null
    ),
  });
}

export const pierreLight = createPierreTheme(pierreLightTheme);
export const pierreDark = createPierreTheme(pierreDarkTheme);
