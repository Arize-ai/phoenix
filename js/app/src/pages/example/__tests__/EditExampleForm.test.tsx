import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { EditExampleForm } from "../EditExampleForm";

vi.mock("@phoenix/components/code", () => ({
  JSONEditor: ({
    value,
    onBlur,
    onChange,
  }: {
    value: string;
    onBlur: () => void;
    onChange: (value: string) => void;
  }) => (
    <textarea
      value={value}
      onBlur={onBlur}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

function createTestEnvironment() {
  return new Environment({
    network: Network.create(() => Promise.resolve({ data: {} })),
    store: new Store(new RecordSource()),
  });
}

function getButton(container: HTMLElement, name: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === name
  );
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

describe("EditExampleForm", () => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders inline without opening another dialog", async () => {
    const onCancel = vi.fn();

    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <RelayEnvironmentProvider environment={createTestEnvironment()}>
            <EditExampleForm
              exampleId="example-1"
              datasetId="dataset-1"
              currentRevision={{
                input: '{"question":"hello"}',
                output: '{"answer":"world"}',
                metadata: "{}",
              }}
              onCancel={onCancel}
              onCompleted={vi.fn()}
            />
          </RelayEnvironmentProvider>
        </ThemeProvider>
      );
    });

    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
    expect(container.textContent).toContain("Edit Example");

    const saveButton = getButton(container, "Save");
    expect(saveButton.disabled).toBe(true);

    await act(async () => {
      getButton(container, "Cancel").click();
    });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
