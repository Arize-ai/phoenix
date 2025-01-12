import { Logger } from "../types/logger";

export const noopLogger = {
  info: () => undefined,
  error: () => undefined,
  log: () => undefined,
} satisfies Logger;
