import {
  foldInside,
  foldNodeProp,
  indentNodeProp,
  LRLanguage,
} from "@codemirror/language";
// import { parseMixed } from "@lezer/common";
import { styleTags, tags } from "@lezer/highlight";
import { ContextTracker, LocalTokenGroup, LRParser } from "@lezer/lr";

const mustacheParser = parser.configure({
  // props: [
  //   // Add basic folding/indent metadata
  //   foldNodeProp.add({ Conditional: foldInside }),
  //   indentNodeProp.add({
  //     Conditional: (cx) => {
  //       const closed = /^\s*\{% endif/.test(cx.textAfter);
  //       return cx.lineIndent(cx.node.from) + (closed ? 0 : cx.unit);
  //     },
  //   }),
  // ],
  // wrap: parseMixed((node) => {
  //   return node.type.isTop
  //     ? {
  //         parser: htmlLanguage.parser,
  //         overlay: (node) => node.type.name == "Text",
  //       }
  //     : null;
  // }),
});
const mustache = LRLanguage.define({
  name: "mustache",
  parser: mustacheParser,
});

export { mustache };
