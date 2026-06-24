import { RGBA, SyntaxStyle } from "@opentui/core";

/**
 * Shared syntax style for rendering assistant markdown (headings, lists, inline
 * code, fenced code blocks). Tuned for a dark terminal background.
 */
export const markdownSyntaxStyle = SyntaxStyle.fromStyles({
  "markup.heading": { fg: RGBA.fromHex("#58A6FF"), bold: true },
  "markup.heading.1": { fg: RGBA.fromHex("#58A6FF"), bold: true },
  "markup.heading.2": { fg: RGBA.fromHex("#79C0FF"), bold: true },
  "markup.list": { fg: RGBA.fromHex("#FF7B72") },
  "markup.raw": { fg: RGBA.fromHex("#A5D6FF") },
  "markup.bold": { fg: RGBA.fromHex("#E6EDF3"), bold: true },
  "markup.italic": { fg: RGBA.fromHex("#E6EDF3"), italic: true },
  "markup.link": { fg: RGBA.fromHex("#58A6FF"), underline: true },
  keyword: { fg: RGBA.fromHex("#FF7B72") },
  string: { fg: RGBA.fromHex("#A5D6FF") },
  comment: { fg: RGBA.fromHex("#8B949E"), italic: true },
  default: { fg: RGBA.fromHex("#E6EDF3") },
});
