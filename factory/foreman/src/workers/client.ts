import { getAnthropicClient as getWorkerClient } from "@/anthropic/client";
import type { BetaManagedAgentsSession } from "@anthropic-ai/sdk/resources/beta/sessions/sessions";

import { getWorkerConfig, WorkerError } from "./config";

export { getWorkerClient };

export function authorizeRepository(repo: string | undefined): void {
  if (!repo || !getWorkerConfig().FACTORY_WORKER_REPOSITORIES.includes(repo))
    throw new WorkerError("Session or repository is not available.");
}

export async function readWorkerSession(
  sessionId: string
): Promise<BetaManagedAgentsSession> {
  const session = await getWorkerClient().beta.sessions.retrieve(sessionId);
  authorizeRepository(session.metadata.repo);
  if (!session.metadata.lane)
    throw new WorkerError("Session is not a Factory worker.");
  return session;
}
