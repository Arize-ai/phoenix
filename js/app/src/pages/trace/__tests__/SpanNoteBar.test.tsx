import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";
import type * as Contexts from "@phoenix/contexts";

import { SpanNoteBar } from "../SpanNoteBar";

const { notifySuccess, notifyError } = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

// The toasts render in a region the app mounts elsewhere, so assert on the
// calls rather than the DOM
vi.mock("@phoenix/contexts", async (importOriginal) => ({
  ...(await importOriginal<typeof Contexts>()),
  useNotifySuccess: () => notifySuccess,
  useNotifyError: () => notifyError,
}));

installTestMatchMedia();
installTestStorage();

const SPAN_NODE_ID = "U3Bhbjox";

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
  vi.clearAllMocks();
});

function renderSpanNoteBar() {
  const environment = createMockEnvironment();
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <ThemeProvider themeMode="dark">
          <PreferencesProvider isTakingSpanNotes>
            <SpanNoteBar spanNodeId={SPAN_NODE_ID} />
          </PreferencesProvider>
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });
  const textarea = container.querySelector("textarea");
  if (!textarea) {
    throw new Error("Expected the note bar to render a textarea");
  }
  return { environment, textarea };
}

function submitNote(textarea: HTMLTextAreaElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  act(() => {
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      })
    );
  });
}

describe("SpanNoteBar", () => {
  it("confirms a note once it is added", async () => {
    const { environment, textarea } = renderSpanNoteBar();
    submitNote(textarea, "looks off");
    expect(notifySuccess).not.toHaveBeenCalled();

    await act(async () => {
      environment.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation, {
          Span: () => ({ id: SPAN_NODE_ID, spanAnnotations: [] }),
        })
      );
    });

    expect(notifySuccess).toHaveBeenCalledWith({ title: "Note added" });
    expect(notifyError).not.toHaveBeenCalled();
    expect(textarea.value).toBe("");
  });

  it("reports a failed note without confirming it", async () => {
    const { environment, textarea } = renderSpanNoteBar();
    submitNote(textarea, "looks off");

    await act(async () => {
      environment.mock.rejectMostRecentOperation(new Error("Failed to fetch"));
    });

    expect(notifyError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Failed to add note" })
    );
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(textarea.value).toBe("looks off");
  });
});
