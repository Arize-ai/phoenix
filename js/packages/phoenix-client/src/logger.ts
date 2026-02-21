import {
  ENV_PHOENIX_LOG_LEVEL,
  getStrFromEnvironment,
} from "@arizeai/phoenix-config";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  log: (message: string) => void;
  debug: (message: string) => void;
  table: (data: unknown) => void;
};

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

const VALID_LOG_LEVELS: readonly LogLevel[] = [
  "debug",
  "info",
  "warn",
  "error",
  "silent",
];

function isLogLevel(value: string): value is LogLevel {
  return VALID_LOG_LEVELS.includes(value as LogLevel);
}

function getLogLevelFromEnvironment(): LogLevel {
  const value = getStrFromEnvironment(ENV_PHOENIX_LOG_LEVEL);
  if (value && isLogLevel(value)) {
    return value;
  }
  return "info";
}

/**
 * Creates a logger with the given log level, optionally wrapping a custom logger.
 * If no level is provided, reads PHOENIX_LOG_LEVEL from the environment, defaulting to "info".
 * If a custom logger is provided, it is used as the underlying output target instead of console.
 *
 * Log level hierarchy (lowest to highest): debug < info < warn < error < silent
 * Messages below the configured level are suppressed.
 *
 * @example
 * const logger = createLogger(); // uses PHOENIX_LOG_LEVEL env var, defaults to "info"
 * const logger = createLogger({ level: "debug" }); // show all messages including progress
 * const logger = createLogger({ level: "silent" }); // suppress all output
 * const logger = createLogger({ logger: myWinstonLogger }); // wrap a custom logger
 * const logger = createLogger({ level: "warn", logger: myWinstonLogger }); // custom + level filter
 */
export function createLogger({
  level,
  logger,
}: { level?: LogLevel; logger?: Logger } = {}): Logger {
  const resolvedLevel = level ?? getLogLevelFromEnvironment();
  const levelIndex = VALID_LOG_LEVELS.indexOf(resolvedLevel);
  const shouldLog = (l: LogLevel) =>
    VALID_LOG_LEVELS.indexOf(l) >= levelIndex;

  const base = logger ?? console;

  return {
    debug: shouldLog("debug") ? (msg) => base.debug(msg) : () => undefined,
    info: shouldLog("info") ? (msg) => base.info(msg) : () => undefined,
    warn: shouldLog("warn") ? (msg) => base.warn(msg) : () => undefined,
    error: shouldLog("error") ? (msg) => base.error(msg) : () => undefined,
    log: shouldLog("info") ? (msg) => base.log(msg) : () => undefined,
    table: shouldLog("info") ? (data) => base.table(data) : () => undefined,
  };
}
