import type { componentsV1 } from "@arizeai/phoenix-client";

type BusyErrorData = componentsV1["schemas"]["AgentSessionBusyErrorBody"];
type SessionRunState = componentsV1["schemas"]["SessionRunState"];

const SESSION_RUN_STATES: ReadonlySet<SessionRunState> = new Set([
  "idle",
  "streaming",
  "persisting",
  "awaiting_client_tool",
  "mutating",
]);

function isBusyErrorData(value: unknown): value is BusyErrorData {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<BusyErrorData>;
  return (
    candidate.code === "agent_session_busy" &&
    typeof candidate.state === "string" &&
    SESSION_RUN_STATES.has(candidate.state as SessionRunState) &&
    typeof candidate.turnId === "string" &&
    (candidate.assistantMessageId == null ||
      typeof candidate.assistantMessageId === "string") &&
    typeof candidate.ownedByThisInstance === "boolean"
  );
}

/** Structured conflict returned when another turn or mutation owns a session. */
export class PxiBusyError extends Error {
  readonly code = "agent_session_busy" as const;
  readonly state: SessionRunState;
  readonly turnId: string;
  readonly assistantMessageId: string | null;
  readonly ownedByThisInstance: boolean;

  constructor(data: BusyErrorData) {
    const location = data.ownedByThisInstance
      ? "this Phoenix server instance"
      : "another Phoenix server instance";
    super(`PXI session is busy (${data.state}) on ${location}.`);
    this.name = "PxiBusyError";
    this.state = data.state;
    this.turnId = data.turnId;
    this.assistantMessageId = data.assistantMessageId ?? null;
    this.ownedByThisInstance = data.ownedByThisInstance;
  }
}

/** Parse Phoenix's structured session-busy response without consuming it. */
export async function parsePxiBusyError({
  response,
}: {
  response: Response;
}): Promise<PxiBusyError | null> {
  if (response.status !== 409) {
    return null;
  }
  try {
    const data: unknown = await response.clone().json();
    return isBusyErrorData(data) ? new PxiBusyError(data) : null;
  } catch {
    return null;
  }
}
