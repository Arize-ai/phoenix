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
