import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

import { AttributesJSONBlock } from "@phoenix/components/code/AttributesJSONBlock";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

function renderAttributes(attributes: string) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <AttributesJSONBlock attributes={attributes} />
      </ThemeProvider>
    );
  });
}

describe("AttributesJSONBlock", () => {
  it("automatically renders an error alert with malformed attributes", () => {
    renderAttributes('{"valid": true, "truncated":');

    const alert = container.querySelector('[data-variant="danger"]');
    expect(alert?.textContent).toContain("Malformed attributes payload");
    expect(alert?.textContent).toContain("The raw value is shown below");
    expect(container.textContent).toContain('{"valid": true, "truncated":');
  });

  it("does not render an error alert with valid attributes", () => {
    renderAttributes('{"valid": true}');

    expect(container.querySelector('[data-variant="danger"]')).toBeNull();
  });
});
