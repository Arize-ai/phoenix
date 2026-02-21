import { Logger } from "../types/logger";

/**
 * A logger that does nothing
 */
export const noopLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  log: () => undefined,
  debug: () => undefined,
  table: () => undefined,
} satisfies Logger;
