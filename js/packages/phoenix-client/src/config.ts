import type { ClientOptions } from "openapi-fetch";
import z from "zod";

const phoenixEnvironmentSchema = z.object({
  PHOENIX_HOST: z.string().optional(),
  PHOENIX_CLIENT_HEADERS: z
    .string()
    .transform((s) => JSON.parse(s))
    .transform((o) => z.record(z.string()).parse(o))
    .optional(),
});

type PhoenixEnvironment = z.infer<typeof phoenixEnvironmentSchema>;

/**
 * Parse environment variables from an opaque object into a PhoenixEnvironment object.
 *
 * @param environment - The environment variables object-like structure to parse.
 * @returns The parsed PhoenixEnvironment object.
 */
const fromEnvironment = (environment: unknown) => {
  return phoenixEnvironmentSchema.safeParse(environment)?.data ?? {};
};

/**
 * Convert a PhoenixEnvironment object into a ClientOptions object.
 *
 * @param environment - The PhoenixEnvironment object to convert.
 * @returns The converted ClientOptions object.
 */
const phoenixEnvironmentToClientOptions = (
  environment: PhoenixEnvironment,
): Partial<ClientOptions> => {
  const options: Partial<ClientOptions> = {
    baseUrl: environment.PHOENIX_HOST,
    headers: environment.PHOENIX_CLIENT_HEADERS,
  };

  // filter out undefined values
  // this will prevent clobbering over default values when merging
  return Object.fromEntries(
    Object.entries(options).filter(([_, v]) => v !== undefined),
  );
};

/**
 * Get the environment options from the environment.
 *
 * @returns The environment options as a Partial<ClientOptions> object.
 */
export const defaultGetEnvironmentOptions = (): Partial<ClientOptions> => {
  // feature detect process and process.env
  if (typeof process !== "object" || typeof process.env !== "object") {
    return {};
  }
  return phoenixEnvironmentToClientOptions(fromEnvironment(process.env));
};

/**
 * Make the default client options.
 *
 * @returns The default client options as a Partial<ClientOptions> object.
 */
export const makeDefaultClientOptions = (): Partial<ClientOptions> => {
  return {
    baseUrl: "http://localhost:6006",
  };
};
