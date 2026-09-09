import { act } from "react";
import { Dialog } from "react-aria-components";
import { createRoot, type Root } from "react-dom/client";

import { CodeEditorFieldWrapper } from "../CodeEditorFieldWrapper";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function renderInDialog({
  errorMessage,
  description,
}: {
  errorMessage?: string;
  description?: string;
}) {
  act(() => {
    root.render(
      <Dialog>
        <CodeEditorFieldWrapper
          label="Metadata"
          errorMessage={errorMessage}
          description={description}
        >
          <textarea />
        </CodeEditorFieldWrapper>
      </Dialog>
    );
  });
}

describe("CodeEditorFieldWrapper", () => {
  it("renders its error message inside a Dialog", () => {
    renderInDialog({
      errorMessage: "metadata must be a valid JSON object",
      description: "A JSON object",
    });
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe("metadata must be a valid JSON object");
    expect(alert?.getAttribute("slot")).toBe("errorMessage");
    expect(container.querySelector('[slot="description"]')).toBeNull();
    const field = container.querySelector('[role="textbox"]');
    expect(field?.getAttribute("aria-invalid")).toBe("true");
    expect(field?.getAttribute("aria-describedby")).toBe(alert?.id);
  });

  it("renders its description inside a Dialog when there is no error", () => {
    renderInDialog({ description: "A JSON object" });
    const description = container.querySelector('[slot="description"]');
    expect(description?.textContent).toBe("A JSON object");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    const field = container.querySelector('[role="textbox"]');
    expect(field?.getAttribute("aria-invalid")).toBe("false");
    expect(field?.getAttribute("aria-describedby")).toBe(description?.id);
  });
});
