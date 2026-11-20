import { getDatabase } from "@/db/client";
import { readSlackThread } from "@/slack/client";
import { z } from "zod";

import { authorizeRepository } from "./client";
import { getWorkerConfig, laneSchema, repoSchema, WorkerError } from "./config";
import { createReplyInstruction } from "./requests";
import { dispatchWorkerWorkflow } from "./workflows";

export const startSessionSchema = z
  .object({
    repo: repoSchema,
    lane: laneSchema,
    instruction: z.string().trim().min(1).max(20000),
    issue_numbers: z.array(z.number().int().positive()).max(1).optional(),
    pr_numbers: z.array(z.number().int().positive()).max(1).optional(),
  })
  .superRefine((value, context) => {
    const isPrLane = value.lane === "review" || value.lane === "finish";
    if (
      isPrLane
        ? value.pr_numbers?.length !== 1 || Boolean(value.issue_numbers?.length)
        : value.issue_numbers?.length !== 1 || Boolean(value.pr_numbers?.length)
    )
      context.addIssue({
        code: "custom",
        message:
          "Existing issue lanes require one issue; review/finish require one PR.",
      });
  });

export async function startSession({
  foremanId,
  input,
}: {
  foremanId: string;
  input: z.infer<typeof startSessionSchema>;
}): Promise<{
  workflow_run_id: number;
  workflow_url: string;
  request_id: string;
  status: "queued";
}> {
  authorizeRepository(input.repo);
  const config = getWorkerConfig();
  const thread = await getDatabase()
    .selectFrom("slack_threads")
    .select(["channel_id", "thread_timestamp"])
    .where("session_id", "=", foremanId)
    .executeTakeFirstOrThrow();
  const history = await readSlackThread({
    channelId: thread.channel_id,
    threadTimestamp: thread.thread_timestamp,
  });
  const allowedUsers = new Set(
    (process.env.SLACK_ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
  );
  const participants = [
    ...new Set(
      history
        .map((message) => message.user_id)
        .filter(
          (userId): userId is string =>
            userId !== undefined && allowedUsers.has(userId)
        )
    ),
  ];
  if (participants.length > 100)
    throw new WorkerError(
      "Factory starts support at most 100 permitted thread participants."
    );
  const requesters = participants.map(
    (userId) => config.FACTORY_GITHUB_USERS[userId]
  );
  if (!requesters.length || requesters.some((login) => !login))
    throw new WorkerError(
      "Every permitted participant must have a configured GitHub identity before starting work."
    );
  const reply = createReplyInstruction({
    foremanId,
    message: input.instruction,
  });
  const workflow = await dispatchWorkerWorkflow({
    repo: input.repo,
    lane: input.lane,
    targetNumber: (input.pr_numbers ?? input.issue_numbers)![0],
    requesters,
    instruction: reply.instruction,
    replyBinding: reply.requestId,
  });
  return {
    ...workflow,
    request_id: reply.requestId,
    status: "queued",
  };
}
