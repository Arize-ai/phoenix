import { z } from "zod";

/**
 * Zod schema for Phoenix Insight CLI configuration
 *
 * Configuration values can be set via:
 * 1. Config file (~/.phoenix-insight/config.json or custom path)
 * 2. Environment variables (PHOENIX_BASE_URL, PHOENIX_API_KEY, etc.)
 * 3. CLI arguments (--base-url, --api-key, etc.)
 *
 * Priority: config file < env vars < CLI args
 */
export const configSchema = z.object({
  /**
   * Phoenix server base URL
   * @default "http://localhost:6006"
   */
  baseUrl: z.string().default("http://localhost:6006"),

  /**
   * Phoenix API key for authentication (optional)
   */
  apiKey: z.string().optional(),

  /**
   * Maximum number of spans to fetch per project
   * @default 1000
   */
  limit: z.number().int().positive().default(1000),

  /**
   * Enable streaming responses from the agent
   * @default true
   */
  stream: z.boolean().default(true),

  /**
   * Execution mode: "sandbox" for in-memory filesystem, "local" for real filesystem
   * @default "sandbox"
   */
  mode: z.enum(["sandbox", "local"]).default("sandbox"),

  /**
   * Force refresh of snapshot data
   * @default false
   */
  refresh: z.boolean().default(false),

  /**
   * Enable tracing of the agent to Phoenix
   * @default false
   */
  trace: z.boolean().default(false),
});

/**
 * Inferred TypeScript type from the config schema
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Get default configuration values
 */
export function getDefaultConfig(): Config {
  return configSchema.parse({});
}
