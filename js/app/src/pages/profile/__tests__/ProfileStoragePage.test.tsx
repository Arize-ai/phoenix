import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  CREDENTIALS_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "@phoenix/constants/storageConstants";

import { ProfileStoragePage } from "../ProfileStoragePage";

installTestStorage();

let container: HTMLDivElement;
let root: Root;
const reload = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  reload.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

async function renderPage() {
  await act(async () => {
    root.render(<ProfileStoragePage />);
  });
}

function getRow(storeId: string) {
  const row = container.querySelector(
    `[data-testid="storage-store-${storeId}"]`
  );
  if (!row) {
    throw new Error(`missing row ${storeId}`);
  }
  return row;
}

function getRowButton(storeId: string) {
  return getRow(storeId).querySelector("button") as HTMLButtonElement;
}

function getClearAllButton() {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === "Clear all"
  );
  if (!button) {
    throw new Error("missing clear all button");
  }
  return button;
}

async function confirmDialog(label: string) {
  const confirm = Array.from(document.body.querySelectorAll("button")).find(
    (candidate) =>
      candidate.closest('[role="dialog"]') &&
      candidate.textContent?.trim() === label
  );
  if (!confirm) {
    throw new Error(`missing dialog button ${label}`);
  }
  await act(async () => {
    confirm.click();
  });
}

describe("ProfileStoragePage", () => {
  it("reports usage per sub-store and disables clearing empty ones", async () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, '{"displayTimezone":"UTC"}');
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    await renderPage();

    expect(getRow("preferences").textContent).toContain("2 entries");
    expect(getRow("credentials").textContent).toContain("Empty");
    expect(getRowButton("preferences").disabled).toBe(false);
    expect(getRowButton("credentials").disabled).toBe(true);
    expect(
      container.querySelector('[data-testid="storage-total"]')?.textContent
    ).toContain("2 entries");
    expect(getClearAllButton().disabled).toBe(false);
  });

  it("disables clear all when nothing is stored", async () => {
    await renderPage();
    expect(getClearAllButton().disabled).toBe(true);
  });

  it("clears a single sub-store after confirmation and reloads", async () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, "{}");
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, "{}");

    await renderPage();
    await act(async () => {
      getRowButton("preferences").click();
    });
    await confirmDialog("Clear");

    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(CREDENTIALS_STORAGE_KEY)).toBe("{}");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("clears everything after confirmation and reloads", async () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, "{}");
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, "{}");
    localStorage.setItem("unrelated", "keep");

    await renderPage();
    await act(async () => {
      getClearAllButton().click();
    });
    await confirmDialog("Clear all");

    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(CREDENTIALS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
