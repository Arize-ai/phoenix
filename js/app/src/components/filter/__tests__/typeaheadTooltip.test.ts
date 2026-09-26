import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import { createEvaluatorAutocompletion } from "@phoenix/components/evaluators/codeEvaluatorAutocomplete";
import { createTemplateAutocomplete } from "@phoenix/components/templateEditor/autocomplete";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";

import { typeaheadTooltips, typeaheadTooltipSpace } from "../typeaheadTooltip";

const mappingSource = {
  input: { question: "What is the capital of France?" },
  output: { answer: "Paris" },
  metadata: {},
};

const completionSurfaces: [string, () => Extension][] = [
  ["typeaheadTooltips", () => typeaheadTooltips()],
  [
    "template editor",
    () => createTemplateAutocomplete(["input"], TemplateFormats.Mustache),
  ],
  [
    "code evaluator editor",
    () => createEvaluatorAutocompletion({ mappingSource, language: "PYTHON" }),
  ],
];

describe("completion menu hosting", () => {
  afterEach(() => {
    document.getElementById("cm-typeahead-tooltip-layer")?.remove();
  });

  it.each(completionSurfaces)(
    "%s renders its menu outside the editor's clipping ancestors",
    (_name, extension) => {
      const clippingAncestor = document.createElement("div");
      clippingAncestor.style.overflow = "hidden";
      document.body.appendChild(clippingAncestor);
      const view = new EditorView({
        state: EditorState.create({ extensions: [extension()] }),
        parent: clippingAncestor,
      });

      const layer = document.getElementById("cm-typeahead-tooltip-layer");
      expect(layer?.parentElement).toBe(document.body);
      expect(clippingAncestor.contains(layer)).toBe(false);

      view.destroy();
      clippingAncestor.remove();
    }
  );

  it("leaves the menu room for the gap it is translated down by", () => {
    const view = new EditorView({
      state: EditorState.create({ extensions: [typeaheadTooltips()] }),
      parent: document.body,
    });
    const { clientHeight, clientWidth } = document.documentElement;

    expect(typeaheadTooltipSpace(view)).toEqual({
      top: 16,
      left: 0,
      bottom: clientHeight - 16,
      right: clientWidth,
    });

    view.destroy();
  });
});
