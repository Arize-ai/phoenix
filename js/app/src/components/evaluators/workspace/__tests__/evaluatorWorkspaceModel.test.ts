import { describe, expect, it } from "vitest";

import {
  defineEvaluatorWorkspaceLayout,
  resolveSavedWorkspaceModel,
} from "@phoenix/components/evaluators/workspace/evaluatorWorkspaceModel";

const layout = defineEvaluatorWorkspaceLayout<"prompt" | "test">({
  storageKey: "test-workspace",
  panels: { prompt: { title: "Prompt" }, test: { title: "Test" } },
  root: (tab) => ({
    type: "split",
    id: "root",
    orientation: "horizontal",
    children: [
      { type: "tabset", id: "left", tabs: [tab("prompt")] },
      { type: "tabset", id: "right", tabs: [tab("test")] },
    ],
  }),
});

const tab = (panel: string) => ({
  id: panel,
  title: panel,
  data: { panel },
});

/** Both panels moved into one tabset, as a user might arrange them. */
const rearranged = {
  version: 1,
  root: {
    type: "tabset",
    id: "only",
    tabs: [tab("test"), tab("prompt")],
  },
};

describe("resolveSavedWorkspaceModel", () => {
  it("starts from the default when nothing is saved", () => {
    expect(resolveSavedWorkspaceModel({ layout, saved: null })).toBe(
      layout.defaultModel
    );
  });

  it("restores a saved arrangement of the layout's panels", () => {
    const model = resolveSavedWorkspaceModel({
      layout,
      saved: JSON.stringify(rearranged),
    });
    expect(model.root).toMatchObject({
      type: "tabset",
      tabs: [{ id: "test" }, { id: "prompt" }],
    });
  });

  it("keeps every restored tab unclosable", () => {
    const model = resolveSavedWorkspaceModel({
      layout,
      saved: JSON.stringify(rearranged),
    });
    expect(model.root).toMatchObject({
      tabs: [{ disableClose: true }, { disableClose: true }],
    });
  });

  it("starts from the default when a panel is missing from the saved arrangement", () => {
    const saved = JSON.stringify({
      version: 1,
      root: { type: "tabset", id: "only", tabs: [tab("prompt")] },
    });
    expect(resolveSavedWorkspaceModel({ layout, saved })).toBe(
      layout.defaultModel
    );
  });

  it("drops panels the layout no longer has", () => {
    const saved = JSON.stringify({
      ...rearranged,
      root: {
        ...rearranged.root,
        tabs: [...rearranged.root.tabs, tab("gone")],
      },
    });
    const model = resolveSavedWorkspaceModel({ layout, saved });
    expect(model.root).toMatchObject({
      tabs: [{ id: "test" }, { id: "prompt" }],
    });
  });

  it("starts from the default when what was saved is not a model", () => {
    expect(resolveSavedWorkspaceModel({ layout, saved: "{not json" })).toBe(
      layout.defaultModel
    );
    expect(
      resolveSavedWorkspaceModel({ layout, saved: JSON.stringify({ a: 1 }) })
    ).toBe(layout.defaultModel);
  });
});
