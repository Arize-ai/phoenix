import type {
  AgentPageContext,
  ProjectSessionRow,
  ProjectSpanRow,
  ProjectSummary,
  ProjectTraceRow,
  TraceSpanRow,
  TraceSummary,
} from "@phoenix/agent/context/pageContextTypes";

export type PageContextData =
  | {
      pageKind: "generic";
    }
  | {
      pageKind: "project";
      project: ProjectSummary;
      traces: ProjectTraceRow[];
      spans: ProjectSpanRow[];
      sessions: ProjectSessionRow[];
    }
  | {
      pageKind: "trace";
      project: {
        id: string;
        name: string;
      };
      trace: TraceSummary;
      spans: TraceSpanRow[];
    };

export interface PageContextSource {
  id: string;
  load(context: AgentPageContext): Promise<PageContextData>;
}
