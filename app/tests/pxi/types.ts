export type PxiToolCall = {
  name: string;
  input: unknown;
  output: unknown;
};

export type PxiTurn = {
  calledTools: string[];
  toolCalls: PxiToolCall[];
  assistantText: string;
  traceId: string;
  durationMs: number;
};
