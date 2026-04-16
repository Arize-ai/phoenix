import { useState } from "react";

const STORAGE_KEY_PREFIX = "arize-phoenix-modal";

export interface UseDefaultModalWidthOptions {
  /**
   * Stable identifier used to namespace the persisted width. Treat this like
   * a layout key — it must not change between renders of the same drawer.
   */
  id: string;
  /**
   * Storage backend. Defaults to `localStorage`. Pass `sessionStorage` for
   * per-tab persistence, or any object implementing the Web Storage interface
   * (e.g. a test fake) to redirect writes.
   */
  storage?: Storage;
}

export interface UseDefaultModalWidthResult {
  /**
   * The previously persisted width, or `undefined` if nothing has been
   * stored yet under this `id`. Pass into `<Modal defaultWidth={...} />`.
   */
  defaultWidth: number | undefined;
  /**
   * Call to persist a new width. Wire into `<Modal onResize={...} />` so
   * every drag commit gets saved.
   */
  onWidthChange: (width: number) => void;
}

const resolveStorage = (override?: Storage): Storage | null => {
  if (override !== undefined) return override;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    // Accessing `localStorage` throws under some privacy settings.
    return null;
  }
};

/**
 * Persist a resizable `<Modal>`'s width between visits. Mirrors the pattern
 * that `react-resizable-panels` exposes via `useDefaultLayout` — the caller
 * owns the persistence decision and threads the results into the component.
 *
 * ```tsx
 * const { defaultWidth, onWidthChange } = useDefaultModalWidth({
 *   id: "span-details",
 * });
 *
 * <Modal
 *   variant="slideover"
 *   isResizable
 *   defaultWidth={defaultWidth}
 *   onResize={onWidthChange}
 * >
 *   ...
 * </Modal>
 * ```
 */
export function useDefaultModalWidth({
  id,
  storage,
}: UseDefaultModalWidthOptions): UseDefaultModalWidthResult {
  const key = `${STORAGE_KEY_PREFIX}-${id}-width`;
  const resolvedStorage = resolveStorage(storage);

  // Lazy init — read the persisted width exactly once on first render and
  // treat it as the `defaultWidth` for the modal. Subsequent storage reads
  // are not needed because Modal drives width from its own state once mounted.
  const [defaultWidth] = useState<number | undefined>(() => {
    if (!resolvedStorage) return undefined;
    try {
      const raw = resolvedStorage.getItem(key);
      if (!raw) return undefined;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    } catch {
      return undefined;
    }
  });

  const onWidthChange = (width: number) => {
    if (!resolvedStorage) return;
    try {
      resolvedStorage.setItem(key, String(width));
    } catch {
      // Quota exceeded, private mode, etc. — degrade silently.
    }
  };

  return { defaultWidth, onWidthChange };
}
