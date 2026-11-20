import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { getDatabase } from "@/db/client";
import { readSlackThread } from "@/slack/client";
import { z } from "zod";

import { authorizeRepository } from "./client";
import { getWorkerConfig, laneSchema, repoSchema, WorkerError } from "./config";
import { createReplyInstruction } from "./requests";

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

const startResultSchema = z.object({
  session_id: z.string(),
});

export async function startSession({
  foremanId,
  input,
}: {
  foremanId: string;
  input: z.infer<typeof startSessionSchema>;
}): Promise<{ session_id: string; request_id: string; status: "accepted" }> {
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
  const bridge = resolve(process.cwd(), "scripts/worker_bridge.py");
  let isRejected = false;
  const result = await new Promise<z.infer<typeof startResultSchema>>(
    (resolve, reject) => {
      const child = spawn("uv", ["run", "--script", bridge], {
        detached: true,
        stdio: ["pipe", "pipe", "ignore"],
        env: {
          ...process.env,
          GH_REPO: input.repo,
        },
      });
      let output = "";
      child.once("error", () =>
        reject(
          new WorkerError(
            "Factory runtime could not start; check uv and gh installation."
          )
        )
      );
      child.stdin.once("error", () =>
        reject(
          new WorkerError("Factory runtime did not accept the startup request.")
        )
      );
      child.stdout.on("data", (data: Buffer) => {
        output += data.toString();
        if (output.length > 4096) {
          child.stdout.destroy();
          reject(
            new WorkerError("Factory startup returned an invalid response.")
          );
          return;
        }
        if (!output.includes("\n")) return;
        const line: unknown = ((): unknown => {
          try {
            return JSON.parse(output.split("\n")[0]);
          } catch (error) {
            if (error instanceof SyntaxError) return null;
            throw error;
          }
        })();
        const parsed = startResultSchema.safeParse(line);
        const failure = z
          .object({ error: z.string(), uncertain: z.boolean() })
          .safeParse(line);
        isRejected = failure.success && !failure.data.uncertain;
        child.stdout.destroy();
        child.unref();
        if (parsed.success) resolve(parsed.data);
        else
          reject(
            new WorkerError(
              isRejected
                ? "Factory admission rejected this request; check permissions and the target's Factory status comment."
                : "Factory startup is uncertain. Check sessions before retrying; do not retry automatically."
            )
          );
      });
      child.once("exit", () => {
        if (!output.includes("\n"))
          reject(new WorkerError("Factory startup exited without a session."));
      });
      child.stdin.end(
        JSON.stringify({
          ...input,
          instruction: reply.instruction,
          reply_binding: reply.requestId,
          requesters,
        })
      );
    }
  );
  return {
    session_id: result.session_id,
    request_id: reply.requestId,
    status: "accepted",
  };
}
