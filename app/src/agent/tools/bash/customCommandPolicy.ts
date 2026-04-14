/**
 * Trusted policy values supplied by the Phoenix bash runtime to custom shell
 * commands. The shell cannot mutate this object; only the host runtime updates
 * it immediately before command execution.
 */
export type BashCustomCommandPolicy = {
  graphql: {
    allowMutations: boolean;
  };
};

/** Default policy for runtimes that execute without explicit capability overrides. */
export function createDefaultBashCustomCommandPolicy(): BashCustomCommandPolicy {
  return {
    graphql: {
      allowMutations: false,
    },
  };
}
