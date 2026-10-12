import type { ColumnDef } from "@tanstack/react-table";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { ResizableTable } from "../ResizableTable";
import { PrettyTextCell } from "../TextCell";

installTestMatchMedia();
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

async function renderValue(value: unknown, isExpanded = true) {
  const columns: ColumnDef<{ explanation: unknown }>[] = [
    {
      accessorKey: "explanation",
      header: "Explanation",
      cell: (context) => (
        <PrettyTextCell {...context} isExpanded={isExpanded} />
      ),
    },
  ];
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light">
        <ResizableTable
          columns={columns}
          data={[{ explanation: value }]}
          areRowsExpanded={isExpanded}
        />
      </ThemeProvider>
    );
  });
}
describe("PrettyTextCell", () => {
  it.each([null, undefined, 0, false, {}])(
    "keeps the missing/non-string placeholder: %s",
    async (value) => {
      await renderValue(value);
      expect(container.querySelector("td")?.textContent).toBe("--");
    }
  );
  it.each(["", "plain\ntext", '{"broken":', "<script>alert(1)</script>"])(
    "preserves text without HTML interpretation: %s",
    async (value) => {
      await renderValue(value);
      expect(container.querySelector("td")?.textContent).toBe(value);
      expect(container.querySelector("script")).toBeNull();
    }
  );
  it("formats JSON only in expanded rows and responds to the row toggle", async () => {
    const value = '{"reason":"ok","nested":{"items":[1,2]}}';
    await renderValue(value, false);
    expect(container.querySelector("pre")?.textContent).toBe(value);
    expect(container.querySelector(".cm-editor")).toBeNull();
    await renderValue(value, true);
    expect(container.querySelector(".pretty-text")?.textContent).toContain(
      '"reason": "ok"'
    );
    expect(container.querySelector("table")?.dataset.rows).toBe("expanded");
    expect(container.querySelector(".cm-editor, [contenteditable]")).toBeNull();
    await renderValue(value, false);
    expect(container.querySelector(".cm-editor")).toBeNull();
    expect(container.querySelector("pre")?.textContent).toBe(value);
  });
});
