export interface BashToolInput {
  command: string;
  summary?: string;
  /**
   * User-facing, one-sentence description of the change a `phoenix-gql`
   * mutation in the command will make. Shown alongside the mutation approval.
   */
  mutation_intent?: string;
}

export function getBashToolInput(input: unknown): BashToolInput | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const { command, summary, mutation_intent } = input as Partial<BashToolInput>;

  if (typeof command !== "string") {
    return null;
  }

  return {
    command,
    ...(typeof summary === "string" ? { summary } : {}),
    ...(typeof mutation_intent === "string" ? { mutation_intent } : {}),
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
