import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";

import { RetentionPolicyDetailsDrawer } from "../RetentionPolicyDetailsDrawer";

vi.mock("react-relay", async (importOriginal) => {
  const reactRelay = await importOriginal<typeof ReactRelay>();
  return {
    ...reactRelay,
    useLazyLoadQuery: () => {
      throw new Promise(() => {});
    },
  };
});

installTestMatchMedia();
installTestStorage();

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
  vi.restoreAllMocks();
});

describe("RetentionPolicyDetailsDrawer", () => {
  it("renders its suspense fallback inside the drawer dialog", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/settings/data/policies/policy-1"]}>
          <Routes>
            <Route
              path="/settings/data/policies/:policyId"
              element={<RetentionPolicyDetailsDrawer />}
            />
          </Routes>
        </MemoryRouter>
      );
    });

    const drawer = document.querySelector(".drawer");
    const dialog = drawer?.querySelector("[data-testid='dialog']");

    expect(dialog).not.toBeNull();
    expect(dialog?.querySelector(".skeleton")).not.toBeNull();
  });
});
