# Overlay

Every surface that appears over the Phoenix UI — modals, drawers, popovers,
menus (via `Popover`), and the application frame that anchors them. The
module is self-contained by design: it imports no application code, and the
application imports it only through `index.ts`. Treat it like a vendored
package.

An interactive companion to this document lives in Storybook
(`stories/OverlayStacking.mdx` — "Overlay stacking and modality").

## The model

Every overlay answers two independent questions:

1. **Modality** — while this surface is open, can the user still use the
   rest of the page? (an _interaction contract_)
2. **Stacking** — when this surface overlaps another, which paints on top?
   (a _paint order_)

These are orthogonal. Never derive one from the other.

### Modality: three tiers

| Tier               | Component                                   | Blocks                                                                                   | Used for                                                              |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1 — viewport modal | `ViewportModalOverlay` + `ViewportModal`    | The application viewport only. The assistant rail stays interactive. Never `aria-modal`. | Forms, editors — anything the user may want the assistant's help with |
| 2 — window modal   | `ModalOverlay` + `Modal` (plain React Aria) | Everything, rail included                                                                | Destructive confirmations, blocking decisions                         |
| non-modal          | `Popover`, `Drawer`, menus                  | Nothing — but a dismissing press is **consumed**, never passed through                   | Menus, pickers, consult-while-working panels, detail drawers          |

### The frame

The application renders `OverlayFrameProvider` once, and inside its viewport:

- `DrawerPlane` — portal target for `Drawer`; inert while a viewport modal
  is open.
- `ViewportModalPlane` — portal target for `ViewportModalOverlay`.
- `ViewportPortal` — re-homes React Aria portals (toasts) into the viewport.
- `inert={useOverlayFrame()?.isViewportBlocked || undefined}` stamped on each
  region a viewport modal must block (the frame owns _whether_; the host owns
  _which regions_, since only it knows its layout).
- `{...viewportModalInteractionExemptProps}` on controls that must stay
  interactive above Tier 1 (the assistant rail's toggle). Deliberately not
  React Aria's `data-react-aria-top-layer`, which would also exempt the
  element from Tier 2.

Planes are pure portal targets: `pointer-events: none`, no layout, geometry
supplied by the host via `className`/`css`. Everything else about them —
z-index, inert behavior, registration — is this module's.

### Stacking: bands, not numbers

Paint order comes from the app-wide z-index token ladder (defined by the
host, see "Token contract"). `Popover` takes a band through its `stacking`
prop; a nested popover is clamped to at least its parent's band (the clamp
follows React context, so it crosses portals). Only two bands are
requestable — `app-floating` for persistent panel-like surfaces that modals
should cover, and `app-portaled-overlay` (default) for transient
light-dismiss surfaces. The other rungs belong to dedicated components that
pin their own band; letting a popover request them would let a call site
paint a transient surface above a toast.

If a nested overlay is buried, the composition or band assignment is wrong.
Never fix it with a raw z-index.

### Dismissal

- Tier 1 and Tier 2 participate in React Aria's overlay stack, so Escape and
  outside presses resolve top-down against menus and popovers opened above
  them. (`ViewportModal`'s `useOverlay` call is what enrolls it — see the
  comment there.)
- `Drawer` sits _outside_ that stack (it is not a React Aria overlay): its
  document-level Escape listener is guarded by the frame's
  `isViewportBlocked` instead.
- Non-modal popovers/menus opt into `closeOnInteractOutside`: the dismissing
  press is consumed so it cannot activate what sits beneath — the guarantee a
  modal underlay provides, without the scroll lock or the app-wide
  aria-hiding. See `outsideInteraction.ts`.

## Polyfill ledger

This module deliberately carries three patches against react-aria. Each is
annotated at its implementation site with upstream links and a removal
condition; the summary:

| Polyfill                                                                   | Why                                                                                                                                                                                     | Removal condition                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Region-scoped modality (`ViewportModal.tsx`, `frame.tsx`)                  | RA modality is hardwired to the window; `ariaHideOutside`'s `root` option is not plumbed through hooks/RAC (adobe/react-spectrum#8784 closed unfixed, #8796 unmerged, #7743/#7954 open) | RA ships region modality → collapse onto RAC `Modal`             |
| Outside-press consumption for non-modal overlays (`outsideInteraction.ts`) | `usePopover` hardcodes `isDismissable: !isNonModal`; non-modal RAC popovers neither dismiss on outside press nor protect what's beneath                                                 | RA lets non-modal popovers opt into dismissable-with-consumption |
| Trigger-state impersonation (`triggerState.ts`)                            | RAC wires `Dialog`'s `close`/`slot="close"` through `OverlayTriggerStateContext`; overlays RAC doesn't own must supply one                                                              | RA exposes a public way to provide overlay close context         |

## Token contract

The host application must define these CSS custom properties (Phoenix:
`GlobalStyles.tsx`):

- `--global-z-index-local-raised`, `--global-z-index-local-overlay`
- `--global-z-index-app-floating`, `--global-z-index-app-portaled-overlay`,
  `--global-z-index-app-modal-backdrop`, `--global-z-index-app-modal`
- The design tokens used by surface styles (`--global-background-color-*`,
  `--global-border-color-*`, `--global-rounding-*`, `--global-dimension-*`,
  `--global-modal-width-*`, `--global-popover-*`, `--global-overlay-*`,
  `--focus-ring-*`)

## Extending

- **A new blocking surface** → decide its tier first. Tier 2 is plain RAC.
  Tier 1: portal into `ViewportModalPlane` via `ViewportModalOverlay`, or
  follow its shape (register with the frame, `useOverlay` for stack
  enrollment, `FocusScope` for containment).
- **A new non-modal surface** → build on `Popover` (band + consumption come
  free), or for a frame-anchored panel follow `Drawer` (portal into a plane,
  `createDismissTriggerState` for RAC close-wiring, guard any global
  shortcuts on `isViewportBlocked`).
- **A new stacking need** → add a token to the host ladder and, only if
  popovers must request it, a band in `stacking.ts`. Never a raw number.
