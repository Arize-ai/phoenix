import { normalizePath, type Plugin } from "vite";

const REGISTER_IMPORT = 'import "react-devtools-cdt-mcp/register";';

/**
 * Registers the React DevTools tools for Chrome DevTools MCP in the dev server
 * only, so coding agents can inspect the component tree and profile renders.
 *
 * The register module must run before react-dom initializes, so the import is
 * prepended to the app entry instead of living in source. It is kept on the
 * entry's first line so the entry's line numbers do not shift; only columns on
 * line 1 move.
 * `apply: "serve"` keeps the package, and its per-commit overhead, out of
 * production builds.
 *
 * @see https://www.npmjs.com/package/react-devtools-cdt-mcp
 */
export function reactDevtoolsMcpPlugin({ entry }: { entry: string }): Plugin {
  // Vite module ids use forward slashes on every platform
  const entryId = normalizePath(entry);
  return {
    name: "phoenix:react-devtools-mcp",
    apply: "serve",
    enforce: "pre",
    // The dependency scanner reads the entry before this transform runs, so
    // pre-bundle the module up front to avoid a full reload on first load.
    config: () => ({
      optimizeDeps: { include: ["react-devtools-cdt-mcp/register"] },
    }),
    transform(code, id) {
      if (id.split("?")[0] !== entryId) {
        return null;
      }
      return { code: `${REGISTER_IMPORT}${code}`, map: null };
    },
  };
}
