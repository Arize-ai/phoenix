/**
 * The overlay frame — the application-side anchor for every overlay tier.
 *
 * The host application renders one `OverlayFrameProvider` around its frame
 * and mounts the two portal planes (`DrawerPlane`, `ViewportModalPlane`)
 * inside the region that viewport-tier overlays may cover. Overlay
 * components portal into those planes instead of `document.body`, which is
 * what lets a "modal" block the application viewport while a sibling region
 * (the assistant rail) stays interactive.
 *
 * The frame also owns the viewport-blocking state: every open
 * `ViewportModalOverlay` registers itself, and `isViewportBlocked` is true
 * while any registration is live. The host stamps `inert` on the regions a
 * viewport modal must block (see README.md "Tier 1").
 */
import { css } from "@emotion/react";
import type { HTMLAttributes, ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { UNSAFE_PortalProvider } from "react-aria/PortalProvider";

import { LOCAL_OVERLAY_Z_INDEX, LOCAL_RAISED_Z_INDEX } from "./stacking";

type OverlayFrameContextValue = {
  /**
   * The region viewport-tier overlays cover — everything except the
   * assistant rail. `ViewportModalOverlay` uses it to decide whether a press
   * landed outside the viewport (and so must never dismiss), and
   * `ViewportPortal` re-homes React Aria portals into it.
   */
  applicationViewportElement: HTMLDivElement | null;
  /**
   * The `DrawerPlane` element `Drawer` portals into. Spans only the
   * page-content row (a drawer never crosses the top navigation), and goes
   * inert while a viewport modal is open — which is why it is a separate
   * plane from `viewportModalHostElement` rather than one shared host.
   */
  drawerHostElement: HTMLDivElement | null;
  /**
   * True while at least one viewport modal (Tier 1) is open. The host stamps
   * `inert` on each region such a modal must block; overlays outside React
   * Aria's stack (e.g. `Drawer`'s global Escape) guard on it.
   */
  isViewportBlocked: boolean;
  /**
   * The side navigation element, observed by `Drawer` so a maximally
   * expanded drawer keeps a fixed gap beside the nav at its current width.
   */
  sideNavigationElement: HTMLDivElement | null;
  /** Called by each viewport modal on open; drives `isViewportBlocked`. */
  registerViewportOverlay: () => void;
  /** Ref callback for the host's application-viewport element. */
  setApplicationViewportElement: (element: HTMLDivElement | null) => void;
  /** Ref callback used by `DrawerPlane`; hosts rarely call it directly. */
  setDrawerHostElement: (element: HTMLDivElement | null) => void;
  /** Ref callback for the host's side-navigation element. */
  setSideNavigationElement: (element: HTMLDivElement | null) => void;
  /** Ref callback used by `ViewportModalPlane`; hosts rarely call it directly. */
  setViewportModalHostElement: (element: HTMLDivElement | null) => void;
  /** Called by each viewport modal on close; drives `isViewportBlocked`. */
  unregisterViewportOverlay: () => void;
  /**
   * The `ViewportModalPlane` element `ViewportModalOverlay` portals into.
   * Spans the full viewport (navigation included, so the backdrop buries it)
   * and is never inert — it hosts the blocking overlay itself.
   */
  viewportModalHostElement: HTMLDivElement | null;
};

const OverlayFrameContext = createContext<OverlayFrameContextValue | null>(
  null
);

/**
 * Owns the DOM hosts and blocking state for overlays that belong to the
 * application viewport rather than the browser window. Render once, around
 * the application frame.
 */
export function OverlayFrameProvider({ children }: { children: ReactNode }) {
  const [applicationViewportElement, setApplicationViewportElement] =
    useState<HTMLDivElement | null>(null);
  const [drawerHostElement, setDrawerHostElement] =
    useState<HTMLDivElement | null>(null);
  const [sideNavigationElement, setSideNavigationElement] =
    useState<HTMLDivElement | null>(null);
  const [viewportModalHostElement, setViewportModalHostElement] =
    useState<HTMLDivElement | null>(null);
  const [viewportOverlayCount, setViewportOverlayCount] = useState(0);
  const registerViewportOverlay = useCallback(
    () => setViewportOverlayCount((count) => count + 1),
    []
  );
  const unregisterViewportOverlay = useCallback(
    () => setViewportOverlayCount((count) => Math.max(0, count - 1)),
    []
  );

  return (
    <OverlayFrameContext.Provider
      value={{
        applicationViewportElement,
        drawerHostElement,
        isViewportBlocked: viewportOverlayCount > 0,
        registerViewportOverlay,
        setApplicationViewportElement,
        setDrawerHostElement,
        setSideNavigationElement,
        setViewportModalHostElement,
        sideNavigationElement,
        unregisterViewportOverlay,
        viewportModalHostElement,
      }}
    >
      {children}
    </OverlayFrameContext.Provider>
  );
}

/**
 * The frame's low-level API: plane elements, ref setters, and the
 * viewport-blocking flag. Returns null outside an `OverlayFrameProvider`,
 * in which case every overlay falls back to window-scoped behavior
 * (Storybook, tests).
 */
export function useOverlayFrame() {
  return useContext(OverlayFrameContext);
}

/**
 * Marks an element (and its subtree) as exempt from viewport-modal
 * interaction: pressing it never dismisses a viewport modal, and the frame
 * never stamps it `inert`. Used for the assistant rail's controls.
 *
 * This is deliberately NOT React Aria's `data-react-aria-top-layer` — that
 * contract would also keep the element interactive above window modals
 * (Tier 2), which must block everything.
 */
export const VIEWPORT_MODAL_INTERACTION_EXEMPT_ATTRIBUTE =
  "data-viewport-modal-interaction-exempt";

export const VIEWPORT_MODAL_INTERACTION_EXEMPT_SELECTOR = `[${VIEWPORT_MODAL_INTERACTION_EXEMPT_ATTRIBUTE}]`;

/** Spread onto an element to exempt it — `<div {...viewportModalInteractionExemptProps}>`. */
export const viewportModalInteractionExemptProps = {
  [VIEWPORT_MODAL_INTERACTION_EXEMPT_ATTRIBUTE]: "",
} as const;

/**
 * Shared invariants for both planes: a plane is a pure portal target that
 * must never affect layout or intercept input itself. Overlays portaled into
 * it re-enable `pointer-events` on their own surfaces.
 */
const planeCSS = css`
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  pointer-events: none;
`;

const drawerPlaneCSS = css`
  ${planeCSS};
  z-index: ${LOCAL_RAISED_Z_INDEX};
`;

const viewportModalPlaneCSS = css`
  ${planeCSS};
  z-index: ${LOCAL_OVERLAY_Z_INDEX};
`;

type PlaneProps = Omit<HTMLAttributes<HTMLDivElement>, "children">;

/**
 * The portal target for `Drawer`. Mount one inside the application viewport,
 * covering the region drawers may occupy (geometry — e.g. grid placement —
 * is the host's, via `className`/`css`). The plane is inert while a viewport
 * modal is open, because drawers sit beneath Tier 1.
 */
export function DrawerPlane(props: PlaneProps) {
  const frame = useOverlayFrame();
  return (
    <div
      data-testid="application-drawer-plane"
      {...props}
      css={drawerPlaneCSS}
      inert={frame?.isViewportBlocked || undefined}
      ref={frame?.setDrawerHostElement}
    />
  );
}

/**
 * The portal target for `ViewportModalOverlay`. Mount one inside the
 * application viewport, covering the full region a viewport modal blocks.
 * Never inert — it hosts the blocking overlay itself.
 */
export function ViewportModalPlane(props: PlaneProps) {
  const frame = useOverlayFrame();
  return (
    <div
      data-testid="application-viewport-modal-plane"
      {...props}
      css={viewportModalPlaneCSS}
      ref={frame?.setViewportModalHostElement}
    />
  );
}

/**
 * Re-homes React Aria's portals (toasts, and any other
 * `UNSAFE_PortalProvider` consumer) into the application viewport, so
 * surfaces like toasts center over the workspace instead of the window.
 * Falls back to `document.body` outside the frame.
 */
export function ViewportPortal({ children }: { children: ReactNode }) {
  const frame = useOverlayFrame();
  return (
    <UNSAFE_PortalProvider
      getContainer={() => frame?.applicationViewportElement ?? document.body}
    >
      {children}
    </UNSAFE_PortalProvider>
  );
}
