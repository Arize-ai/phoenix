import { randomUUID } from "node:crypto";
import { getAnthropicClient } from "@/anthropic/client";
import { readSignedToken, signToken } from "@/mcp/tokens";
import { messageDispatcher } from "@/messages/runtime";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getWorkerClient, readWorkerSession } from "./client";
import { WorkerError } from "./config";

const replySchema = z.object({
  purpose: z.literal("reply"),
  foreman_id: z.string().min(1),
  worker_id: z.string().min(1),
  request_id: z.uuid(),
  is_start: z.boolean(),
});

/** Attach a signed return marker to a worker request. */
export function createReplyInstruction({
  foremanId,
  workerId,
  message,
}: {
  foremanId: string;
  workerId?: string;
  message: string;
}): { requestId: string; instruction: string } {
  const requestId = randomUUID();
  const token = signToken({
    purpose: "reply",
    foreman_id: foremanId,
    worker_id: workerId ?? requestId,
    request_id: requestId,
    is_start: !workerId,
  });
  return {
    requestId,
    instruction: `${message}\n\nBegin your answer to this request with this exact line:\nREPLYING_TO: ${token}\nIf you answer several queued requests together, use each request's REPLYING_TO line immediately before its own answer. Do not alter or reuse another request's marker.`,
  };
}

/** Send a worker follow-up and return acceptance. */
export async function sendSessionMessage({
  foremanId,
  sessionId,
  message,
}: {
  foremanId: string;
  sessionId: string;
  message: string;
}): Promise<{ session_id: string; request_id: string; status: "accepted" }> {
  await readWorkerSession(sessionId);
  const reply = createReplyInstruction({
    foremanId,
    workerId: sessionId,
    message,
  });
  await getWorkerClient().beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.message",
        content: [{ type: "text", text: reply.instruction }],
      },
    ],
  });
  return {
    session_id: sessionId,
    request_id: reply.requestId,
    status: "accepted",
  };
}

/** Forward verified worker answers to their originating Foreman. */
export async function relayWorkerReply({
  workerId,
  completedAt,
}: {
  workerId: string;
  completedAt: string;
}): Promise<void> {
  let session;
  try {
    session = await readWorkerSession(workerId);
  } catch (error) {
    if (
      error instanceof WorkerError ||
      error instanceof Anthropic.NotFoundError
    )
      return;
    throw error;
  }
  const page = await getWorkerClient().beta.sessions.events.list(workerId, {
    types: ["agent.message"],
    order: "desc",
    limit: 100,
    "created_at[lte]": completedAt,
  });
  for (const event of [...page.data].reverse()) {
    if (event.type !== "agent.message") continue;
    const text = event.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const markers = [...text.matchAll(/^REPLYING_TO: ([^\r\n]*)\r?$/gm)];
    for (const [index, marker] of markers.entries()) {
      const route = replySchema.safeParse(readSignedToken(marker[1]));
      if (!route.success) continue;
      const reply = route.data;
      if (
        reply.worker_id !==
        (reply.is_start ? session.metadata.factory_reply_id : workerId)
      )
        continue;
      const answer = text
        .slice(
          marker.index + marker[0].length,
          markers[index + 1]?.index ?? text.length
        )
        .trim();
      if (!answer) continue;
      await messageDispatcher.dispatch({
        threadKey: `worker-reply:${reply.foreman_id}`,
        messageKey: `worker-reply:${workerId}:${event.id}:${reply.request_id}`,
        deliver: async () => {
          await getAnthropicClient().beta.sessions.events.send(
            reply.foreman_id,
            {
              events: [
                {
                  type: "user.message",
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        source: "factory_worker",
                        request_id: reply.request_id,
                        session_id: workerId,
                        text: answer,
                      }),
                    },
                  ],
                },
              ],
            }
          );
        },
      });
    }
  }
}
