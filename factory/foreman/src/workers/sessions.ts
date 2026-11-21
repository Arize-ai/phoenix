import type { BetaManagedAgentsSession } from "@anthropic-ai/sdk/resources/beta/sessions/sessions";
import { z } from "zod";

import {
  authorizeRepository,
  getWorkerClient,
  readWorkerSession,
} from "./client";
import { laneSchema, repoSchema, WorkerError } from "./config";

const positiveInteger = z.number().int().positive();
export const findSessionsSchema = z
  .object({
    repo: repoSchema.optional(),
    issue_number: positiveInteger.optional(),
    pr_number: positiveInteger.optional(),
    lane: laneSchema.optional(),
    status: z
      .enum(["idle", "running", "rescheduling", "terminated"])
      .optional(),
    limit: positiveInteger.max(100).default(25),
    cursor: z.string().max(4096).optional(),
  })
  .refine(
    (value) => !(value.issue_number || value.pr_number) || Boolean(value.repo),
    "Issue/PR filters require repo."
  );
export const getSessionSchema = z.object({
  session_id: z.string().min(1).max(128),
  before_cursor: z.string().max(4096).optional(),
  limit: positiveInteger.max(100).default(25),
});

function readNumbers(value: string | undefined): number[] {
  if (!value) return [];
  try {
    return z.array(positiveInteger).parse(JSON.parse(value));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) return [];
    throw error;
  }
}

export function describeSession(
  session: BetaManagedAgentsSession
): Pick<
  BetaManagedAgentsSession,
  "title" | "status" | "metadata" | "created_at" | "updated_at"
> & { session_id: string; agent: string } {
  return {
    session_id: session.id,
    title: session.title,
    status: session.status,
    metadata: session.metadata,
    agent: session.agent.id,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

export async function findSessions(
  input: z.infer<typeof findSessionsSchema>
): Promise<{
  sessions: ReturnType<typeof describeSession>[];
  next_cursor: string | null;
  scanned: number;
}> {
  if (input.repo) authorizeRepository(input.repo);
  const page = await getWorkerClient().beta.sessions.list({
    limit: input.limit,
    page: input.cursor,
    statuses: input.status ? [input.status] : undefined,
    order: "desc",
  });
  const sessions = page.data.filter((session) => {
    try {
      authorizeRepository(session.metadata.repo);
    } catch (error) {
      if (error instanceof WorkerError) return false;
      throw error;
    }
    return (
      Boolean(session.metadata.lane) &&
      (!input.repo || session.metadata.repo === input.repo) &&
      (!input.lane || session.metadata.lane === input.lane) &&
      (!input.issue_number ||
        readNumbers(session.metadata.issues).includes(input.issue_number)) &&
      (!input.pr_number ||
        readNumbers(session.metadata.prs).includes(input.pr_number))
    );
  });
  return {
    sessions: sessions.map(describeSession),
    next_cursor: page.next_page,
    scanned: page.data.length,
  };
}

export async function getSession(
  input: z.infer<typeof getSessionSchema>
): Promise<
  ReturnType<typeof describeSession> & {
    messages: {
      id: string;
      role: string;
      processed_at: string | null;
      text: string;
    }[];
    before_cursor: string | null;
  }
> {
  const session = await readWorkerSession(input.session_id);
  const page = await getWorkerClient().beta.sessions.events.list(session.id, {
    types: ["agent.message", "user.message"],
    order: "desc",
    limit: input.limit,
    page: input.before_cursor,
  });
  return {
    ...describeSession(session),
    messages: page.data.flatMap((event) => {
      if (event.type !== "agent.message" && event.type !== "user.message")
        return [];
      return [
        {
          id: event.id,
          role: event.type === "agent.message" ? "assistant" : "user",
          processed_at: event.processed_at ?? null,
          text: event.content
            .flatMap((block) => (block.type === "text" ? [block.text] : []))
            .join("\n"),
        },
      ];
    }),
    before_cursor: page.next_page,
  };
}
