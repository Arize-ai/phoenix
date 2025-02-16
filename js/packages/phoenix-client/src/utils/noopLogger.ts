import { Logger } from "../types/logger";

/**
 * A logger that does nothing
 */
export const noopLogger = {
  info: () => undefined,
  error: () => undefined,
  log: () => undefined,
} satisfies Logger;
