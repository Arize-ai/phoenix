import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatasetPreviewTable } from "../DatasetPreviewTable";

const getPollutedValue = (): unknown =>
  Reflect.get(Object.prototype, "polluted");

const deletePollutedValue = () => {
  Reflect.deleteProperty(Object.prototype, "polluted");
};

vi.mock("@phoenix/components", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@phoenix/components/core/counter", () => ({
  Counter: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@phoenix/components/table", () => ({
  CompactJSONCell: ({ getValue }: { getValue: () => unknown }) => (
    <span>{JSON.stringify(getValue())}</span>
  ),
}));

describe("DatasetPreviewTable", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    deletePollutedValue();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    deletePollutedValue();
    vi.restoreAllMocks();
  });

  it("renders assigned dotted columns as nested preview buckets", () => {
    act(() => {
      root.render(
        <DatasetPreviewTable
          columns={["input.user.name", "output.answer", "metadata.source"]}
          rows={[["Ada", "42", "csv"]]}
          inputColumns={["input.user.name"]}
          outputColumns={["output.answer"]}
          metadataColumns={["metadata.source"]}
        />
      );
    });

    expect(container.textContent).toContain('{"user":{"name":"Ada"}}');
    expect(container.textContent).toContain('{"answer":"42"}');
    expect(container.textContent).toContain('{"source":"csv"}');
  });

  it("does not pollute Object.prototype for a direct __proto__ path", () => {
    act(() => {
      root.render(
        <DatasetPreviewTable
          columns={["input.__proto__.polluted", "output.answer"]}
          rows={[["yes", "ok"]]}
          inputColumns={["input.__proto__.polluted"]}
          outputColumns={["output.answer"]}
          metadataColumns={[]}
        />
      );
    });

    expect(getPollutedValue()).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
    expect(container.textContent).toContain('{"__proto__":{"polluted":"yes"}}');
  });

  it("does not pollute Object.prototype when a nested key traverses through a parsed object", () => {
    act(() => {
      root.render(
        <DatasetPreviewTable
          columns={[
            "input.payload",
            "input.payload.__proto__.polluted",
            "output.answer",
          ]}
          rows={[["{}", "yes", "ok"]]}
          inputColumns={["input.payload", "input.payload.__proto__.polluted"]}
          outputColumns={["output.answer"]}
          metadataColumns={[]}
        />
      );
    });

    expect(getPollutedValue()).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });
});
