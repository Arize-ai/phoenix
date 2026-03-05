import type { Node } from "./core";

export interface SessionTrace extends Node {
  traceId: string;
  startTime: string;
  endTime: string;
}

export interface Session extends Node {
  sessionId: string;
  projectId: string;
  startTime: string;
  endTime: string;
  traces: SessionTrace[];
}
