import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import type { NotificationQueue } from "@phoenix/contexts";
import {
  createToastQueue,
  PreferencesProvider,
  ThemeProvider,
  ToastQueueProvider,
} from "@phoenix/contexts";

import { SpanNoteBar } from "../SpanNoteBar";

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
});

function renderSpanNoteBar() {
  const environment = createMockEnvironment();
  const queue = createToastQueue();
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <ToastQueueProvider queue={queue}>
          <ThemeProvider themeMode="dark">
            <PreferencesProvider isTakingSpanNotes>
              <SpanNoteBar spanNodeId={SPAN_NODE_ID} />
            </PreferencesProvider>
          </ThemeProvider>
        </ToastQueueProvider>
      </RelayEnvironmentProvider>
    );
  });
  const textarea = container.querySelector("textarea");
  if (!textarea) {
    throw new Error("Expected the note bar to render a textarea");
  }
  return { environment, queue, textarea };
}

function getToasts(queue: NotificationQueue) {
  return queue.visibleToasts.map((toast) => toast.content);
}

function submitNote({
  textarea,
  value,
}: {
  textarea: HTMLTextAreaElement;
  value: string;
}): void {
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
    const { environment, queue, textarea } = renderSpanNoteBar();
    submitNote({ textarea, value: "looks off" });
    expect(getToasts(queue)).toEqual([]);

    await act(async () => {
      environment.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation, {
          Span: () => ({ id: SPAN_NODE_ID, spanAnnotations: [] }),
        })
      );
    });

    expect(getToasts(queue)).toEqual([
      { title: "Note added", variant: "success" },
    ]);
    expect(textarea.value).toBe("");
  });

  it("reports a failed note without confirming it", async () => {
    const { environment, queue, textarea } = renderSpanNoteBar();
    submitNote({ textarea, value: "looks off" });

    await act(async () => {
      environment.mock.rejectMostRecentOperation(new Error("Failed to fetch"));
    });

    expect(getToasts(queue)).toEqual([
      expect.objectContaining({
        title: "Failed to add note",
        variant: "error",
      }),
    ]);
    expect(textarea.value).toBe("looks off");
  });
});
