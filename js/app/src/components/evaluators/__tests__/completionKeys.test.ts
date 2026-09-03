import {
  autocompletion,
  completionStatus,
  startCompletion,
} from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import { closeCompletionOnEscape } from "../completionKeys";

describe("closeCompletionOnEscape", () => {
  it("keeps Escape inside the editor while a menu is open, and lets it out after", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const reachedParent: string[] = [];
    parent.addEventListener("keydown", (event) =>
      reachedParent.push(event.key)
    );
    const view = new EditorView({
      state: EditorState.create({
        extensions: [
          closeCompletionOnEscape,
          autocompletion({
            override: [() => ({ from: 0, options: [{ label: "input" }] })],
          }),
        ],
      }),
      parent,
    });
    const escape = () =>
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        })
      );

    startCompletion(view);
    expect(completionStatus(view.state)).not.toBeNull();
    escape();
    expect(completionStatus(view.state)).toBeNull();
    expect(reachedParent).toEqual([]);

    escape();
    expect(reachedParent).toEqual(["Escape"]);
    view.destroy();
    parent.remove();
  });
});
