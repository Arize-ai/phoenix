/* eslint-disable no-console */
/**
 * Prints the Phoenix configuration resolved from the environment.
 *
 * Values come from process environment variables, falling back to the nearest
 * `.env.phoenix` file — discovered by walking up from the current working
 * directory. Process values always win; set `PHOENIX_DISCOVER_CONFIG=false`
 * to disable file discovery.
 *
 * Try it from the package root:
 *
 * ```bash
 * printf 'PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006\nPHOENIX_PROJECT=demo\n' > .env.phoenix
 * chmod 600 .env.phoenix
 * npx tsx examples/read_from_env.ts
 * rm .env.phoenix
 * ```
 */

import { getEnvironmentConfig } from "../src";

console.log(getEnvironmentConfig());
