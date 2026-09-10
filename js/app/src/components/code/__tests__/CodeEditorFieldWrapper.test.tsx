import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Dialog } from "@phoenix/components";

import { CodeEditorFieldWrapper } from "../CodeEditorFieldWrapper";

const ERROR_MESSAGE = "metadata must be a valid JSON object";

describe("CodeEditorFieldWrapper", () => {
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
  });

  it("renders the validation message inside a dialog (#16027)", () => {
    act(() => {
      root.render(
        <Dialog>
          <CodeEditorFieldWrapper label="Metadata" errorMessage={ERROR_MESSAGE}>
            <div>editor</div>
          </CodeEditorFieldWrapper>
        </Dialog>
      );
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe(ERROR_MESSAGE);
    expect(
      container.querySelector(".json-editor-wrap.is-invalid")
    ).not.toBeNull();
  });

  it("renders the validation message outside a dialog", () => {
    act(() => {
      root.render(
        <CodeEditorFieldWrapper label="Metadata" errorMessage={ERROR_MESSAGE}>
          <div>editor</div>
        </CodeEditorFieldWrapper>
      );
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      ERROR_MESSAGE
    );
  });

  it("shows the description when there is no error", () => {
    act(() => {
      root.render(
        <Dialog>
          <CodeEditorFieldWrapper label="Metadata" description="Optional JSON">
            <div>editor</div>
          </CodeEditorFieldWrapper>
        </Dialog>
      );
    });

    expect(container.textContent).toContain("Optional JSON");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
