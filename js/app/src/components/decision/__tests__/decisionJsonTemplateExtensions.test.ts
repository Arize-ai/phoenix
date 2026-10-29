import { json } from "@codemirror/lang-json";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";

import { findJsonValueSelection } from "../decisionJsonTemplateExtensions";

const DOC = `{
  "ticket": {"id": "T-1", "tags": ["a", "b"]},
  "tier": "gold",
  "open": 2
}`;

function select(text: string, { occurrence = 0 } = {}) {
  const state = EditorState.create({ doc: DOC, extensions: [json()] });
  ensureSyntaxTree(state, state.doc.length, 1000);
  let from = -1;
  for (let index = 0; index <= occurrence; index++) {
    from = DOC.indexOf(text, from + 1);
  }
  return findJsonValueSelection({ state, from, to: from + text.length });
}

describe("findJsonValueSelection", () => {
  it("picks a property's value when its name is selected", () => {
    expect(select("ticket")).toMatchObject({
      kind: "value",
      nodeName: "Object",
      source: '{"id": "T-1", "tags": ["a", "b"]}',
      propertyName: "ticket",
    });
  });

  it("picks the smallest value holding the selection", () => {
    expect(select("gold")).toMatchObject({
      kind: "value",
      nodeName: "String",
      source: '"gold"',
      propertyName: "tier",
    });
    expect(select("2")).toMatchObject({
      kind: "value",
      nodeName: "Number",
      propertyName: "open",
    });
    expect(select('["a", "b"]')).toMatchObject({
      nodeName: "Array",
      propertyName: "tags",
    });
  });

  it("picks part of a string's text as text inside the string", () => {
    expect(select("T-")).toMatchObject({
      kind: "text",
      source: "T-",
      propertyName: "id",
    });
  });

  it("picks nothing for an empty selection", () => {
    const state = EditorState.create({ doc: DOC, extensions: [json()] });
    expect(findJsonValueSelection({ state, from: 3, to: 3 })).toBeNull();
  });
});
