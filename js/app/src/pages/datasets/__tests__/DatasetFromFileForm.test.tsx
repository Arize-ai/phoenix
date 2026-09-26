import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { DatasetFromFileForm } from "../DatasetFromFileForm";

const EXAMPLE_ID_LABEL = "Example ID Column (optional)";

const nodeId = (n: number) => btoa(`DatasetExample:${n}`);

/**
 * Mirrors the header and shape of `GET /v1/datasets/{id}/csv`
 * (`_get_content_csv`): `id` is the external id, or the DatasetExample
 * GlobalID when the example has none; `node_id` is always the GlobalID.
 */
function exportedCsv(ids: string[]): File {
  const rows = ids.map(
    (id, i) => `${id},${nodeId(i + 1)},question ${i},answer ${i},"[""train""]"`
  );
  const text = ["id,node_id,input.question,output.answer,splits", ...rows].join(
    "\n"
  );
  const file = new File([text + "\n"], "exported.csv", { type: "text/csv" });
  // jsdom's File has no stream(); parseCSVFile reads through it.
  Object.defineProperty(file, "stream", {
    value: () => new Response(text + "\n").body,
  });
  return file;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function findSelectButton(container: HTMLElement, label: string) {
  // react-aria's Select renders its <Label> as a span; climb to the field.
  let field = Array.from(container.querySelectorAll("*")).find(
    (el) => el.childElementCount === 0 && el.textContent === label
  )?.parentElement;
  while (field && !field.querySelector("button")) field = field.parentElement;
  const button = field?.querySelector("button");
  if (!button)
    throw new Error(
      `select "${label}" not rendered; page text: ${container.textContent}`
    );
  return button;
}

describe("DatasetFromFileForm (create mode) re-uploading an exported CSV", () => {
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

  async function renderAndSelect(file: File) {
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
    if (!input)
      throw new Error(`file input not rendered: ${container.innerHTML}`);
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await vi.waitFor(async () => {
      await flush();
      findSelectButton(container, EXAMPLE_ID_LABEL);
    });
  }

  it.each([
    {
      scenario: "id column holds Phoenix DatasetExample node IDs",
      ids: [nodeId(1), nodeId(2), nodeId(3)],
      expectedExampleId: "None",
    },
    {
      scenario: "id column holds plain external IDs",
      ids: ["ext-1", "ext-2", "ext-3"],
      expectedExampleId: "id",
    },
  ])(
    "auto-selects Example ID = $expectedExampleId when the $scenario",
    async ({ ids, expectedExampleId }) => {
      await renderAndSelect(exportedCsv(ids));
      expect(
        findSelectButton(container, EXAMPLE_ID_LABEL).textContent
      ).toContain(expectedExampleId);
    }
  );

  it("shows the server's 422 detail instead of the bare status text", async () => {
    const detail =
      "No examples found in this dataset with the following IDs: ext-1";
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail }), {
          status: 422,
          statusText: "Unprocessable Entity",
          headers: { "Content-Type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    await renderAndSelect(exportedCsv(["ext-1", "ext-2"]));
    const submit = container.querySelector<HTMLButtonElement>(
      '[data-testid="dataset-from-file-form-submit-button"]'
    );
    if (!submit) throw new Error("submit button not rendered");
    await vi.waitFor(async () => {
      await flush();
      expect(submit.disabled).toBe(false);
    });
    await act(async () => {
      submit.click();
    });
    await vi.waitFor(async () => {
      await flush();
      // wait for the submit to settle (button label returns from "Creating...")
      expect(submit.textContent).toBe("Create Dataset");
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(container.textContent).toContain(detail);
  });
});
