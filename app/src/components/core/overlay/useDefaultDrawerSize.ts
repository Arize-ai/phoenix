import { useRef, useState } from "react";

import type { SizeValue } from "@phoenix/types/sizing";

const STORAGE_KEY_PREFIX = "arize-phoenix-drawer";
// Drag emits at rAF rate (~60/sec); wait for motion to settle before
// writing so we persist once per resize session rather than on every tick.
const PERSIST_DEBOUNCE_MS = 250;

export interface UseDefaultDrawerSizeOptions {
  /**
   * Stable identifier used to namespace the persisted size. Treat this like
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

export interface UseDefaultDrawerSizeResult {
  /**
   * The previously persisted size as a viewport percentage string (e.g.
   * `"50%"`), or `undefined` if nothing has been stored yet under this `id`.
   * Pass into `<Drawer defaultSize={...} />`.
   */
  defaultSize: SizeValue | undefined;
  /**
   * Call to persist a new size. Wire into `<Drawer onResize={...} />` so
   * every drag commit gets saved.
   */
  onSizeChange: (sizePercent: number) => void;
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
 * Persist a `<Drawer>`'s size between visits. The value is stored as a
 * viewport percentage (e.g. `50` for 50%) and returned as a
 * {@link SizeValue} string (e.g. `"50%"`).
 *
 * ```tsx
 * const { defaultSize, onSizeChange } = useDefaultDrawerSize({
 *   id: "span-details",
 * });
 *
 * <Drawer
 *   isOpen={selectedId != null}
 *   onClose={() => setSelectedId(null)}
 *   defaultSize={defaultSize}
 *   onResize={onSizeChange}
 * >
 *   ...
 * </Drawer>
 * ```
 */
export function useDefaultDrawerSize({
  id,
  storage,
}: UseDefaultDrawerSizeOptions): UseDefaultDrawerSizeResult {
  const key = `${STORAGE_KEY_PREFIX}-${id}-size`;
  const resolvedStorage = resolveStorage(storage);

  // Lazy init — read the persisted size exactly once on first render and
  // treat it as the `defaultSize` for the drawer. Subsequent storage reads
  // are not needed because Drawer drives size from its own state once mounted.
  const [defaultSize] = useState<SizeValue | undefined>(() => {
    if (!resolvedStorage) return undefined;
    try {
      const raw = resolvedStorage.getItem(key);
      if (!raw) return undefined;
      const parsed = Number(raw);
      // Valid percentages are in (0, 100]. Values outside this range are
      // invalid — return undefined so the drawer falls back to its default.
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100)
        return undefined;
      return `${parsed}%`;
    } catch {
      return undefined;
    }
  });

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSizeChange = (sizePercent: number) => {
    if (!resolvedStorage) return;
    if (pendingTimerRef.current != null) {
      clearTimeout(pendingTimerRef.current);
    }
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      try {
        resolvedStorage.setItem(key, String(sizePercent));
      } catch {
        // Quota exceeded, private mode, etc. — degrade silently.
      }
    }, PERSIST_DEBOUNCE_MS);
  };

  return { defaultSize, onSizeChange };
}
