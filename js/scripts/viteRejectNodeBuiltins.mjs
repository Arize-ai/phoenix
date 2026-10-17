const NODE_BUILTIN_SPECIFIER_PATTERN = /\bnode:[a-z0-9_./-]+/iu;

/**
 * Fail a Vite build if a supported non-Node entry point reaches a Node
 * built-in module.
 *
 * @param {object} params - Plugin configuration.
 * @param {string} params.targetName - Runtime target shown in failure messages.
 * @returns {import("vite").Plugin} A Vite plugin that rejects Node built-ins.
 */
export function createRejectNodeBuiltinsPlugin({ targetName }) {
  return {
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") {
          continue;
        }
        const nodeBuiltinSpecifier = output.code.match(
          NODE_BUILTIN_SPECIFIER_PATTERN
        )?.[0];
        if (nodeBuiltinSpecifier) {
          throw new Error(
            `${targetName} build included Node built-in ${nodeBuiltinSpecifier}`
          );
        }
      }
    },
    name: "reject-node-builtins",
    resolveId(source) {
      if (source.startsWith("node:")) {
        throw new Error(`${targetName} build reached Node built-in ${source}`);
      }
      return null;
    },
  };
}
