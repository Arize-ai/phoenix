type ToolTiming = { startedAt: string; endedAt?: string };

/** Records browser execution brackets for server-synthesized client-tool spans. */
export function createClientToolTimingRecorder({
  getCurrentTime = () => new Date(),
}: {
  /** Clock override for deterministic tests. */
  getCurrentTime?: () => Date;
} = {}) {
  const timingsByToolCallId = new Map<string, ToolTiming>();
  return {
    recordStart: (toolCallId: string): void => {
      if (!timingsByToolCallId.has(toolCallId)) {
        timingsByToolCallId.set(toolCallId, {
          startedAt: getCurrentTime().toISOString(),
        });
      }
    },
    recordEnd: (toolCallId: string): void => {
      const timing = timingsByToolCallId.get(toolCallId);
      if (timing && timing.endedAt == null) {
        timing.endedAt = getCurrentTime().toISOString();
      }
    },
    get: (toolCallId: string): Required<ToolTiming> | null => {
      const timing = timingsByToolCallId.get(toolCallId);
      return timing?.endedAt != null
        ? { startedAt: timing.startedAt, endedAt: timing.endedAt }
        : null;
    },
    clear: (): void => timingsByToolCallId.clear(),
  };
}

export type ClientToolTimingRecorder = ReturnType<
  typeof createClientToolTimingRecorder
>;
