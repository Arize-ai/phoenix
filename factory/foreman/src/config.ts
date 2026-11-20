import { getMcpConfig } from "@/workers/config";
import { z } from "zod";

const configSchema = z.object({
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_BOT_USER_ID: z.string().min(1),
  SLACK_WORKSPACE_ID: z.string().min(1),
  SLACK_ALLOWED_USER_IDS: z
    .string()
    .trim()
    .min(1)
    .transform(
      (value) =>
        new Set(
          value
            .split(",")
            .map((userId) => userId.trim())
            .filter(Boolean)
        )
    ),
  FACTORY_FOREMAN_AGENT_ID: z.string().min(1),
  FACTORY_FOREMAN_ENVIRONMENT_ID: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_WEBHOOK_SIGNING_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

export type ServiceConfig = z.infer<typeof configSchema> &
  ReturnType<typeof getMcpConfig>;

export function getServiceConfig(): ServiceConfig {
  return { ...configSchema.parse(process.env), ...getMcpConfig() };
}
