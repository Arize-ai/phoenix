import type { components } from "@phoenix/api/__generated__/v1";

export type TurnTraceContext = components["schemas"]["TurnTraceContext"];

/** Holds the server-minted trace identity across requests in one logical turn. */
export function createTurnTraceContextManager() {
  let active: TurnTraceContext | null = null;
  return {
    getActive: () => active,
    captureFromMetadata: (
      turnTraceContext: TurnTraceContext | null | undefined
    ): void => {
      if (turnTraceContext) {
        active = turnTraceContext;
      }
    },
    clear: (): void => {
      active = null;
    },
  };
}

export type TurnTraceContextManager = ReturnType<
  typeof createTurnTraceContextManager
>;
