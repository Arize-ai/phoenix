/**
 * Trigger-state adapters — every place this module hands React Aria a
 * trigger state that React Aria did not create itself.
 *
 * React Aria Components wires `Dialog`'s render-prop `close` and
 * `slot="close"` buttons through `OverlayTriggerStateContext`. Overlays that
 * RAC does not own (Drawer, ViewportModal) still want that wiring, so they
 * provide a state of their own. This file is the single point of
 * impersonation: if a react-aria upgrade changes the `OverlayTriggerState`
 * shape, this file is the only one that needs to follow (`satisfies` makes
 * a missing member a build error here, not a silent behavior change).
 */
import { useContext } from "react";
import type { OverlayTriggerState } from "react-aria-components";
import { OverlayTriggerStateContext } from "react-aria-components";
import type { OverlayTriggerProps } from "react-stately";
import { useOverlayTriggerState } from "react-stately";

/**
 * Resolve the trigger state for an overlay that may be driven three ways:
 * controlled (`isOpen`), uncontrolled with a default (`defaultOpen`), or
 * adopted from an ancestor RAC trigger (e.g. `DialogTrigger`) when neither
 * prop is given. The first two delegate to react-stately's
 * `useOverlayTriggerState`; the third reuses the ancestor's state so the
 * trigger's `aria-expanded`, focus restore, and toggle behavior keep
 * working.
 */
export function useResolvedOverlayTriggerState(
  props: OverlayTriggerProps
): OverlayTriggerState {
  const contextState = useContext(OverlayTriggerStateContext);
  const ownState = useOverlayTriggerState(props);
  const shouldAdoptContextState =
    props.isOpen == null && props.defaultOpen == null && contextState != null;
  return shouldAdoptContextState ? contextState : ownState;
}

/**
 * A trigger state for an overlay whose openness lives outside React Aria
 * entirely (e.g. `Drawer`, driven by a route or selection): always open
 * while mounted, and every closing transition funnels into `onClose`.
 *
 * `point` anchors an overlay to the cursor (context menus). These overlays
 * are anchored by their own geometry, so it stays null and `setPoint` is a
 * no-op.
 */
export function createDismissTriggerState(
  onClose: () => void
): OverlayTriggerState {
  return {
    isOpen: true,
    open: () => {},
    close: onClose,
    toggle: onClose,
    setOpen: (isOpen: boolean) => {
      if (!isOpen) onClose();
    },
    point: null,
    setPoint: () => {},
  } satisfies OverlayTriggerState;
}

/**
 * Wrap a trigger state so every closing transition runs `close` (which must
 * itself delegate to the wrapped state) — used by `ViewportModalOverlay` to
 * release the frame's blocked state synchronously before the overlay
 * unmounts.
 */
export function withInterceptedClose(
  state: OverlayTriggerState,
  close: () => void
): OverlayTriggerState {
  return {
    ...state,
    close,
    setOpen: (isOpen: boolean) => {
      if (!isOpen) {
        close();
        return;
      }
      state.setOpen(true);
    },
    toggle: () => {
      if (state.isOpen) close();
      else state.open();
    },
  } satisfies OverlayTriggerState;
}
