import { z } from "zod";

export const laneSchema = z.enum([
  "bug",
  "feature",
  "docs",
  "review",
  "finish",
]);
export const repoSchema = z.string().regex(/^[\w.-]+\/[\w.-]+$/);

const mcpSchema = z.object({
  FACTORY_MCP_URL: z.url({ protocol: /^https$/ }),
  FACTORY_MCP_BEARER_SECRET: z
    .string()
    .min(32)
    .regex(/^[A-Za-z0-9_-]+$/),
});

const workerSchema = z.object({
  FACTORY_WORKER_REPOSITORIES: z
    .string()
    .default("Arize-ai/phoenix")
    .transform((value) =>
      value.split(",").map((repo) => repoSchema.parse(repo.trim()))
    ),
  FACTORY_GITHUB_USERS: z
    .string()
    .default("{}")
    .transform((value) =>
      z
        .record(z.string(), z.string().regex(/^[A-Za-z0-9-]+$/))
        .parse(JSON.parse(value))
    ),
});

export function getMcpConfig(): z.infer<typeof mcpSchema> {
  return mcpSchema.parse(process.env);
}

export function getWorkerConfig(): z.infer<typeof workerSchema> {
  return workerSchema.parse(process.env);
}

export class WorkerError extends Error {}
