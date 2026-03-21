/**
 * `tsx` can expose workspace package ESM exports under a synthetic `default`
 * object during local development. Normalize that shape so the CLI can run
 * from source and from compiled output.
 */
export function getInteropExports<T extends object>(moduleExports: T): T {
  const defaultExport = (moduleExports as { default?: unknown }).default;

  if (typeof defaultExport === "object" && defaultExport !== null) {
    return defaultExport as T;
  }

  return moduleExports;
}
