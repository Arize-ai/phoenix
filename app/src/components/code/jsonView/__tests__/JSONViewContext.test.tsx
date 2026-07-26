import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  JSONViewProvider,
  useJSONView,
  type JSONViewContextValue,
} from "../JSONViewContext";

/**
 * Span attributes as they are recorded: `output.value` and
 * `llm.invocation_parameters` each hold a serialized JSON string rather than a
 * nested object.
 */
const ATTRIBUTES = JSON.stringify({
  output: { value: '["Paris.","Lyon."]' },
  llm: { invocation_parameters: '{"temperature":0.7}' },
});

let view: JSONViewContextValue | null = null;

function Probe() {
  view = useJSONView();
  return null;
}

function currentView(): JSONViewContextValue {
  if (view === null) {
    throw new Error("the provider did not render");
  }
  return view;
}

describe("JSONViewProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    view = null;
  });

  function render(mode: "json" | "table", value: string = ATTRIBUTES) {
    act(() => {
      root.render(
        <JSONViewProvider value={value} defaultMode={mode} indexNotation="dot">
          <Probe />
        </JSONViewProvider>
      );
    });
  }

  it("keys the table's rows by the attribute keys as they were recorded", () => {
    render("table");
    const keys = currentView().entries.map((entry) => entry.key);

    // a serialized list is one attribute, so it is one row: flattening through
    // it would invent `output.value.0`, a key that addresses nothing on the
    // span and cannot be pasted back into instrumentation
    expect(keys).toStrictEqual(["output.value", "llm.invocation_parameters"]);
    expect(currentView().entries[0]?.value).toBe('["Paris.","Lyon."]');
  });

  it("leaves the JSON document as recorded until un-nesting is asked for", () => {
    render("json");
    expect(JSON.parse(currentView().jsonText)).toStrictEqual({
      output: { value: '["Paris.","Lyon."]' },
      llm: { invocation_parameters: '{"temperature":0.7}' },
    });

    act(() => currentView().setIsExpanded(true));
    expect(JSON.parse(currentView().jsonText)).toStrictEqual({
      output: { value: ["Paris.", "Lyon."] },
      llm: { invocation_parameters: { temperature: 0.7 } },
    });
  });

  it("copies every row it is showing, including keys that flatten alike", () => {
    // a recorded key holding the separator collides with a nested one, so the
    // two attributes below are two distinct rows both named `metadata.a.b`
    render("table", JSON.stringify({ metadata: { "a.b": 1, a: { b: 2 } } }));

    expect(currentView().entries.map((entry) => entry.key)).toStrictEqual([
      "metadata.a.b",
      "metadata.a.b",
    ]);
    expect(JSON.parse(currentView().copyText)).toStrictEqual([
      { key: "metadata.a.b", value: 1 },
      { key: "metadata.a.b", value: 2 },
    ]);
  });

  it("copies only the rows left by the search", () => {
    render("table");

    act(() => currentView().setQuery("invocation"));
    expect(JSON.parse(currentView().copyText)).toStrictEqual([
      { key: "llm.invocation_parameters", value: '{"temperature":0.7}' },
    ]);
  });
});
