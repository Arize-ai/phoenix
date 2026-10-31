import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { ExperimentOutputContent } from "../ExperimentOutputContent";

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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

function renderOutput(value: unknown) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="dark">
        <ExperimentOutputContent value={value} />
      </ThemeProvider>
    );
  });
}

function chatOutput(content: string) {
  return { messages: [{ role: "assistant", content }] };
}

describe("ExperimentOutputContent", () => {
  it("pretty-prints assistant content that is a JSON string", () => {
    renderOutput(chatOutput('{"category":"billing","confidence":0.9}'));

    const editor = container.querySelector(".cm-content");
    expect(editor?.textContent).toContain('"category": "billing"');
    expect(container.querySelector("h1")).toBeNull();
  });

  it("renders other assistant content as markdown", () => {
    renderOutput(chatOutput("# Hello"));

    expect(container.querySelector("h1")?.textContent).toBe("Hello");
    expect(container.querySelector(".cm-content")).toBeNull();
  });
});
