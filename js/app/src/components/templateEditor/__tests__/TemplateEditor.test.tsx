import { EditorView } from "@codemirror/view";
import { act, Suspense } from "react";
import { createRoot } from "react-dom/client";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { TemplateFormats } from "../constants";
import { TemplateEditor } from "../TemplateEditor";

// jsdom has no layout; CodeMirror measures ranges when it draws the cursor.
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

let pending: Promise<void> | null = null;

/** Suspends while `pending` is set, like a task menu fetching its options. */
function SuspendWhilePending() {
  if (pending) {
    throw pending;
  }
  return null;
}

it("keeps what was typed when a Suspense boundary above it hides and reveals it", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = vi.fn();
  const render = () =>
    root.render(
      <ThemeContext.Provider
        value={{
          theme: "light",
          themeMode: "light",
          systemTheme: "light",
          setThemeMode: vi.fn(),
        }}
      >
        <Suspense fallback={null}>
          <TemplateEditor
            aria-label="Instructions"
            templateFormat={TemplateFormats.Mustache}
            defaultValue="Saved"
            onChange={onChange}
          />
          <SuspendWhilePending />
        </Suspense>
      </ThemeContext.Provider>
    );
  const getText = () => {
    const editor = container.querySelector<HTMLElement>(".cm-editor");
    return editor ? EditorView.findFromDOM(editor)?.state.doc.toString() : null;
  };
  try {
    await act(async () => render());
    const editor = container.querySelector<HTMLElement>(".cm-editor");
    const view = editor ? EditorView.findFromDOM(editor) : null;
    await act(async () =>
      view?.dispatch({ changes: { from: 0, insert: "Edited. " } })
    );
    expect(onChange).toHaveBeenLastCalledWith(
      "Edited. Saved",
      expect.anything()
    );
    expect(getText()).toBe("Edited. Saved");

    let resolve = () => {};
    pending = new Promise<void>((done) => {
      resolve = done;
    });
    await act(async () => render());
    pending = null;
    await act(async () => {
      resolve();
      await Promise.resolve();
    });

    expect(getText()).toBe("Edited. Saved");
  } finally {
    pending = null;
    act(() => root.unmount());
    container.remove();
  }
});
