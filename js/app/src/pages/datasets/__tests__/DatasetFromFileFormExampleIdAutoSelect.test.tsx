import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { DatasetFromFileForm } from "../DatasetFromFileForm";

const EXAMPLE_ID_LABEL = "Example ID Column (optional)";

/** The DatasetExample GlobalID, as `GET /v1/datasets/{id}/csv` writes it. */
const datasetExampleNodeId = (n: number) => btoa(`DatasetExample:${n}`);

/**
 * A CSV with the header `GET /v1/datasets/{id}/csv` writes: `id` holds the
 * external ID, or the DatasetExample GlobalID when the example has none.
 */
function exportShapedCsv(ids: string[]): File {
  const rows = ids.map(
    (id, i) =>
      `${id},${datasetExampleNodeId(i + 1)},question ${i},answer ${i},"[]"`
  );
  const text =
    ["id,node_id,input.question,output.answer,splits", ...rows].join("\n") +
    "\n";
  return withStream(new File([text], "exported.csv", { type: "text/csv" }));
}

// jsdom's File lacks stream(), which parseCSVFile reads through; serve the
// file's own bytes.
function withStream(file: File): File {
  Object.defineProperty(file, "stream", {
    value: () =>
      new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new Uint8Array(await file.arrayBuffer()));
          controller.close();
        },
      }),
  });
  return file;
}

function exampleIdSelection(container: HTMLElement): string | null {
  // react-aria renders the Select's <Label> as a span next to its trigger.
  const label = Array.from(container.querySelectorAll("span")).find(
    (el) => el.textContent === EXAMPLE_ID_LABEL
  );
  let field = label?.parentElement ?? null;
  while (field && !field.querySelector("button")) field = field.parentElement;
  return field?.querySelector("button")?.textContent ?? null;
}

describe("DatasetFromFileForm Example ID auto-selection in create mode", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function selectFile(file: File) {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <DatasetFromFileForm
            mode="create"
            onCancel={() => {}}
            onDatasetCreated={() => {}}
          />
        </ThemeProvider>
      );
    });
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input not rendered");
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await vi.waitFor(() => {
      expect(exampleIdSelection(container)).not.toBeNull();
    });
  }

  it("leaves Example ID as None for an id column of node IDs, but selects one of external IDs", async () => {
    await selectFile(
      exportShapedCsv([datasetExampleNodeId(1), datasetExampleNodeId(2)])
    );
    expect(exampleIdSelection(container)).toBe("None");

    act(() => root.unmount());
    root = createRoot(container);
    await selectFile(exportShapedCsv(["ext-1", "ext-2"]));
    expect(exampleIdSelection(container)).toBe("id");
  });
});
