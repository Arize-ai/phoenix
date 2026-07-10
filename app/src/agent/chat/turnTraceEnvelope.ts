import type { components } from "@phoenix/api/__generated__/v1";

export type TurnTraceEnvelope = components["schemas"]["TurnTraceEnvelope"];

/** Holds the server-minted trace identity across requests in one logical turn. */
export function createTurnEnvelopeManager() {
  let active: TurnTraceEnvelope | null = null;
  return {
    getActive: () => active,
    captureFromMetadata: (turn: TurnTraceEnvelope | null | undefined): void => {
      if (turn) {
        active = turn;
      }
    },
    clear: (): void => {
      active = null;
    },
  };
}

export type TurnEnvelopeManager = ReturnType<typeof createTurnEnvelopeManager>;
