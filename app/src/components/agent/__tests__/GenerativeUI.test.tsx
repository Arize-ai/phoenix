import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  GenerativeUI,
  LEGACY_JSON_RENDER_DATA_PART_TYPE,
} from "@phoenix/components/agent/GenerativeUI";

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

function renderGeneratedUI(parts: unknown[]) {
  act(() => {
    root.render(
      <GenerativeUI
        parts={parts as Parameters<typeof GenerativeUI>[0]["parts"]}
      />
    );
  });
}

describe("GenerativeUI", () => {
  it("renders valid generated UI specs", () => {
    renderGeneratedUI([
      {
        type: LEGACY_JSON_RENDER_DATA_PART_TYPE,
        data: {
          root: "title",
          elements: {
            title: {
              type: "Title",
              props: { text: "Trace Summary" },
              children: [],
            },
          },
        },
      },
    ]);

    expect(container.textContent).toContain("Trace Summary");
  });

  it("does not attempt to render invalid generated UI specs", () => {
    renderGeneratedUI([
      {
        type: LEGACY_JSON_RENDER_DATA_PART_TYPE,
        data: {
          root: "chart",
          elements: {
            chart: {
              type: "LineChart",
              props: { title: null, data: null },
              children: [],
            },
          },
        },
      },
    ]);

    expect(container.textContent).toContain(
      "Generated UI was requested, but no renderable spec was found in the message parts."
    );
  });

  it("renders failed generated UI tool calls as tool parts, not generated UI", () => {
    renderGeneratedUI([
      {
        type: "tool-render_generated_ui",
        state: "output-error",
        input: {
          spec: {
            root: "chart",
            elements: {
              chart: {
                type: "LineChart",
                props: { title: null, data: null },
                children: [],
              },
            },
          },
        },
      },
    ]);

    expect(container.textContent).toContain(
      "Generated UI was requested, but no renderable spec was found in the message parts."
    );
  });
});
