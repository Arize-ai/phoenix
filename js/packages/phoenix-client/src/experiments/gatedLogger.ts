import { type Logger } from "../types/logger";

/**
 * Internal type for extended logger with gated methods.
 * Supports verbose/summary methods and optional progress tracking.
 * @internal
 */
export type GatedLogger = {
  verbose(msg: string): void;
  info(msg: string): void;
  error(msg: string): void;
  summary(msg: string): void;
  startProgress?(total: number, label: string): void;
  tickProgress?(): void;
  stopProgress?(): void;
};

/**
 * Wraps a Logger into a GatedLogger.
 *
 * If the logger has `verbose` and `summary` methods (i.e. it is a full-featured
 * Logger class instance), use it directly — it manages verbosity internally.
 * Otherwise (plain console or custom logger), create a wrapper where verbose is
 * a no-op and summary delegates to info.
 * @internal
 */
export function toGatedLogger(logger: Logger): GatedLogger {
  if ("verbose" in logger && "summary" in logger) {
    return logger as unknown as GatedLogger;
  }
  return {
    verbose: () => {},
    info: (msg) => logger.info(msg),
    error: (msg) => logger.error(msg),
    summary: (msg) => logger.info(msg),
  };
}
