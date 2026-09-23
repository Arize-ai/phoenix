import type { z } from "zod";

/**
 * Scopes a local-storage key to the deployment's root path.
 *
 * `localStorage` is origin-scoped and path-blind. In multi-tenant deployments
 * (e.g. Phoenix Cloud) many workspaces are served from distinct root paths on
 * the SAME browser origin, so a single shared key would let one workspace's
 * persisted state load in another. Scoping by the root-path basename aligns
 * this with the per-deployment isolation boundary already enforced
 * server-side by PHOENIX_COOKIES_PATH (which is set to the same root path).
 *
 * Deployments without a root path (the common single-tenant case, e.g. OSS)
 * use the base key unchanged so existing state is preserved on upgrade. Under
 * a root path the new scoped key simply leaves the old unscoped blob
 * untouched; nothing reads it once the key changes.
 *
 * Call at read/write time, not module scope — `window.Config` must already
 * be present for the basename to resolve.
 */
export function scopeStorageKeyToBasename(baseKey: string): string {
  const basename = (window.Config?.basename ?? "").replace(/\/+$/, "");
  return basename ? `${baseKey}:${basename}` : baseKey;
}

/**
 * A workspace-scoped, schema-validated localStorage slot. The key is
 * resolved through {@link scopeStorageKeyToBasename} at read/write time (not
 * module load — `window.Config` must be present), and anything missing or
 * malformed reads back as `fallback` rather than surfacing a broken
 * half-state.
 */
export function createScopedStorageItem<T, F>({
  baseKey,
  schema,
  fallback,
}: {
  baseKey: string;
  schema: z.ZodType<T>;
  fallback: F;
}): {
  resolveKey: () => string;
  get: () => T | F;
  set: (value: T) => void;
} {
  const resolveKey = () => scopeStorageKeyToBasename(baseKey);
  return {
    resolveKey,
    get: () => {
      try {
        const raw = localStorage.getItem(resolveKey());
        if (!raw) {
          return fallback;
        }
        const parsed = schema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : fallback;
      } catch {
        return fallback;
      }
    },
    set: (value: T) => {
      localStorage.setItem(resolveKey(), JSON.stringify(value));
    },
  };
}
