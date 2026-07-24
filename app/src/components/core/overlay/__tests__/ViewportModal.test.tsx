import { act, useState, type ReactNode } from "react";
import { Button, Dialog, DialogTrigger, Heading } from "react-aria-components";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppFrameOverlayProvider,
  useAppFrameOverlay,
} from "../AppFrameOverlayContext";
import { Modal, ModalOverlay } from "../Modal";
import { ViewportModal, ViewportModalOverlay } from "../ViewportModal";

function Frame({ children }: { children: ReactNode }) {
  return (
    <AppFrameOverlayProvider>
      <FrameContent>{children}</FrameContent>
    </AppFrameOverlayProvider>
  );
}

function FrameContent({ children }: { children: ReactNode }) {
  const frame = useAppFrameOverlay();
  return (
    <div ref={frame?.setApplicationViewportElement}>
      <main
        data-testid="viewport-content"
        inert={frame?.isViewportBlocked || undefined}
      >
        {children}
      </main>
      <div
        data-testid="drawer-plane"
        inert={frame?.isViewportBlocked || undefined}
        ref={frame?.setDrawerHostElement}
      />
      <div
        data-testid="viewport-modal-plane"
        ref={frame?.setViewportModalHostElement}
      />
      <aside data-testid="assistant-rail">
        <button type="button">Rail action</button>
      </aside>
    </div>
  );
}

function TriggeredViewportModal() {
  return (
    <DialogTrigger>
      <Button>Open form</Button>
      <ViewportModalOverlay>
        <ViewportModal>
          <Dialog>
            <Heading slot="title">Edit dataset</Heading>
            <Button>Change section</Button>
            <DialogTrigger>
              <Button>Delete dataset</Button>
              <ModalOverlay>
                <Modal>
                  <Dialog>
                    <Heading slot="title">Confirm deletion</Heading>
                    <Button slot="close">Cancel deletion</Button>
                  </Dialog>
                </Modal>
              </ModalOverlay>
            </DialogTrigger>
            <Button slot="close">Close form</Button>
          </Dialog>
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}

function ControlledViewportModals() {
  const [isFirstOpen, setIsFirstOpen] = useState(true);
  const [isSecondOpen, setIsSecondOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setIsFirstOpen(false)}>
        Close first
      </button>
      <button type="button" onClick={() => setIsSecondOpen(false)}>
        Close second
      </button>
      <ViewportModalOverlay isOpen={isFirstOpen} onOpenChange={setIsFirstOpen}>
        <ViewportModal>
          <Dialog aria-label="First form" />
        </ViewportModal>
      </ViewportModalOverlay>
      <ViewportModalOverlay
        isOpen={isSecondOpen}
        onOpenChange={setIsSecondOpen}
      >
        <ViewportModal>
          <Dialog aria-label="Second form" />
        </ViewportModal>
      </ViewportModalOverlay>
    </>
  );
}

describe("ViewportModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("portals into the frame plane and blocks only viewport-owned cells", () => {
    act(() =>
      root.render(
        <Frame>
          <TriggeredViewportModal />
        </Frame>
      )
    );

    const trigger = container.querySelector<HTMLButtonElement>("main button");
    act(() => trigger?.click());

    const modalPlane = container.querySelector(
      '[data-testid="viewport-modal-plane"]'
    );
    const overlay = modalPlane?.querySelector(
      '[data-testid="viewport-modal-overlay"]'
    );
    const dialog = modalPlane?.querySelector('[role="dialog"]');

    expect(overlay).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBeNull();
    expect(dialog?.getAttribute("aria-labelledby")).not.toBeNull();
    expect(
      container
        .querySelector('[data-testid="viewport-content"]')
        ?.hasAttribute("inert")
    ).toBe(true);
    expect(
      container
        .querySelector('[data-testid="drawer-plane"]')
        ?.hasAttribute("inert")
    ).toBe(true);
    expect(
      container
        .querySelector('[data-testid="assistant-rail"]')
        ?.hasAttribute("inert")
    ).toBe(false);
  });

  it("keeps the viewport blocked until the last viewport modal closes", () => {
    act(() =>
      root.render(
        <Frame>
          <ControlledViewportModals />
        </Frame>
      )
    );

    const content = container.querySelector('[data-testid="viewport-content"]');
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("main > button")
    );
    expect(content?.hasAttribute("inert")).toBe(true);

    act(() => buttons[0]?.click());
    expect(content?.hasAttribute("inert")).toBe(true);

    act(() => buttons[1]?.click());
    expect(content?.hasAttribute("inert")).toBe(false);
  });

  it("does not close when Escape is pressed in the collaborative rail", () => {
    act(() =>
      root.render(
        <Frame>
          <TriggeredViewportModal />
        </Frame>
      )
    );
    act(() =>
      container.querySelector<HTMLButtonElement>("main button")?.click()
    );

    const railButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="assistant-rail"] button'
    );
    act(() => {
      railButton?.focus();
      railButton?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      );
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("clears the trigger press responder inside the portaled dialog", () => {
    act(() =>
      root.render(
        <Frame>
          <TriggeredViewportModal />
        </Frame>
      )
    );
    act(() =>
      container.querySelector<HTMLButtonElement>("main button")?.click()
    );

    const sectionButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')
    ).find((button) => button.textContent === "Change section");
    act(() => sectionButton?.click());

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("lets a nested window modal block the form and rail, then restores Tier 1", async () => {
    act(() =>
      root.render(
        <Frame>
          <TriggeredViewportModal />
        </Frame>
      )
    );
    act(() =>
      container.querySelector<HTMLButtonElement>("main button")?.click()
    );

    const rail = container.querySelector('[data-testid="assistant-rail"]');
    const viewportContent = container.querySelector(
      '[data-testid="viewport-content"]'
    );
    const tier1Dialog = container.querySelector('[role="dialog"]');
    const deleteButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')
    ).find((button) => button.textContent === "Delete dataset");

    expect(rail?.closest("[inert]")).toBeNull();
    act(() => deleteButton?.click());

    const tier2Overlay = document.body.querySelector(
      '[data-testid="modal-overlay"]'
    );
    expect(tier2Overlay).not.toBeNull();
    // jsdom lacks native inert, so React Aria uses its aria-hidden fallback.
    expect(rail?.closest('[inert], [aria-hidden="true"]')).not.toBeNull();
    expect(
      tier1Dialog?.closest('[inert], [aria-hidden="true"]')
    ).not.toBeNull();

    const cancelButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        '[data-testid="modal-overlay"] button'
      )
    ).find((button) => button.textContent === "Cancel deletion");
    act(() => cancelButton?.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(
      document.body.querySelector('[data-testid="modal-overlay"]')
    ).toBeNull();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(viewportContent?.hasAttribute("inert")).toBe(true);
    expect(rail?.closest("[inert]")).toBeNull();
  });

  it("releases inert state before closing and restores the trigger", async () => {
    act(() =>
      root.render(
        <Frame>
          <TriggeredViewportModal />
        </Frame>
      )
    );
    const trigger = container.querySelector<HTMLButtonElement>("main button");
    act(() => {
      trigger?.focus();
      trigger?.click();
    });

    const closeButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')
    ).find((button) => button.textContent === "Close form");
    act(() => closeButton?.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(
      container
        .querySelector('[data-testid="viewport-content"]')
        ?.hasAttribute("inert")
    ).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});
