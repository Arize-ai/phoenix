// TypeScript 7 (native compiler) ships no JS compiler API. Tools that consume
// the API (ts.factory, ts.createProgram, ...) get the official
// @typescript/typescript6 bridge as a regular dependency instead of resolving
// the workspace typescript@7 peer. Remove entries as tools adopt the TS 7.1+ API.
const TYPESCRIPT6 = "npm:@typescript/typescript6@^6.0.2";

const NEEDS_TS6_API = new Set([
  "openapi-typescript", // generate:openapi (runs in typescript-CI)
  "react-docgen-typescript", // storybook docgen
  "@joshwooding/vite-plugin-react-docgen-typescript", // storybook docgen vite plugin
]);

function readPackage(pkg) {
  if (NEEDS_TS6_API.has(pkg.name) && pkg.peerDependencies?.typescript) {
    delete pkg.peerDependencies.typescript;
    if (pkg.peerDependenciesMeta?.typescript) {
      delete pkg.peerDependenciesMeta.typescript;
    }
    pkg.dependencies = { ...pkg.dependencies, typescript: TYPESCRIPT6 };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
