export interface BashToolInput {
  command: string;
  summary?: string;
}

export function getBashToolInput(input: unknown): BashToolInput | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const { command, summary } = input as Partial<BashToolInput>;

  if (typeof command !== "string") {
    return null;
  }

  return {
    command,
    ...(typeof summary === "string" ? { summary } : {}),
  };
}

/**
 * Read the `summary` from a partial (still-streaming) bash tool input. Unlike
 * {@link getBashToolInput}, it does not require `command`, which streams in
 * after `summary`.
 */
export function getBashToolSummary(input: unknown): string | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const { summary } = input as Partial<BashToolInput>;

  return typeof summary === "string" && summary.length > 0 ? summary : null;
}
