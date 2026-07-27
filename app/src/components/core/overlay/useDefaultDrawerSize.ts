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
   * Factory size used when no user preference has been stored. Numeric values
   * remain pixel based so the drawer can grow toward a content-derived target
   * as viewport space becomes available without growing beyond it.
   */
  defaultSize?: SizeValue;
  /** Unit used to store explicit user resize preferences. */
  persistenceUnit?: "percentage" | "pixels";
  /** Optional minimum applied when restoring a finite pixel preference. */
  minimumSize?: number;
  /**
   * Storage backend. Defaults to `localStorage`. Pass `sessionStorage` for
   * per-tab persistence, or any object implementing the Web Storage interface
   * (e.g. a test fake) to redirect writes.
   */
  storage?: Storage;
}

export interface UseDefaultDrawerSizeResult {
  /**
   * The previously persisted size in the configured unit, the factory
   * default, or `undefined` if neither exists. Pass into
   * `<Drawer defaultSize={...} />`.
   */
  defaultSize: SizeValue | undefined;
  /**
   * Call to persist a new size. Wire into `<Drawer onResize={...} />` so
   * every drag commit gets saved.
   */
  onSizeChange: (sizePercent: number, sizePixels?: number) => void;
  /**
   * Persist the released size synchronously. Wire into
   * `<Drawer onResizeEnd={...} />` so closing and reopening immediately after
   * a resize cannot restore the previous size while a debounced write is
   * still pending.
   */
  onSizeChangeEnd: (sizePercent: number, sizePixels?: number) => void;
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
 * Persist a `<Drawer>`'s size between visits. Percentage persistence remains
 * the default; pixel persistence is available for drawers whose factory size
 * is derived from the preferred widths of their inner columns.
 *
 * ```tsx
 * const { defaultSize, onSizeChange, onSizeChangeEnd } =
 *   useDefaultDrawerSize({
 *   id: "span-details",
 * });
 *
 * <Drawer
 *   isOpen={selectedId != null}
 *   onClose={() => setSelectedId(null)}
 *   defaultSize={defaultSize}
 *   onResize={onSizeChange}
 *   onResizeEnd={onSizeChangeEnd}
 * >
 *   ...
 * </Drawer>
 * ```
 */
export function useDefaultDrawerSize({
  id,
  defaultSize: factoryDefaultSize,
  persistenceUnit = "percentage",
  minimumSize,
  storage,
}: UseDefaultDrawerSizeOptions): UseDefaultDrawerSizeResult {
  const key = `${STORAGE_KEY_PREFIX}-${id}-size`;
  const resolvedStorage = resolveStorage(storage);

  // Lazy init — read the persisted size exactly once on first render and
  // treat it as the `defaultSize` for the drawer. Subsequent storage reads
  // are not needed because Drawer drives size from its own state once mounted.
  const [defaultSize] = useState<SizeValue | undefined>(() => {
    if (!resolvedStorage) return factoryDefaultSize;
    try {
      const raw = resolvedStorage.getItem(key);
      if (!raw) return factoryDefaultSize;
      const parsed = Number(raw);
      const isValidPercentage = parsed > 0 && parsed <= 100;
      const isValidPixelSize = minimumSize != null || parsed > 0;
      if (
        !Number.isFinite(parsed) ||
        (persistenceUnit === "percentage"
          ? !isValidPercentage
          : !isValidPixelSize)
      ) {
        return factoryDefaultSize;
      }
      return persistenceUnit === "percentage"
        ? `${parsed}%`
        : Math.max(parsed, minimumSize ?? parsed);
    } catch {
      return factoryDefaultSize;
    }
  });

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistSize = ({
    sizePercent,
    sizePixels,
  }: {
    sizePercent: number;
    sizePixels?: number;
  }) => {
    if (!resolvedStorage) return;
    try {
      const size =
        persistenceUnit === "percentage"
          ? sizePercent
          : (sizePixels ?? (sizePercent / 100) * window.innerWidth);
      resolvedStorage.setItem(key, String(size));
    } catch {
      // Quota exceeded, private mode, etc. — degrade silently.
    }
  };

  const onSizeChange = (sizePercent: number, sizePixels?: number) => {
    if (!resolvedStorage) return;
    if (pendingTimerRef.current != null) {
      clearTimeout(pendingTimerRef.current);
    }
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      persistSize({ sizePercent, sizePixels });
    }, PERSIST_DEBOUNCE_MS);
  };

  const onSizeChangeEnd = (sizePercent: number, sizePixels?: number) => {
    if (pendingTimerRef.current != null) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    persistSize({ sizePercent, sizePixels });
  };

  return { defaultSize, onSizeChange, onSizeChangeEnd };
}
