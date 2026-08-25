import type { FrontierFilterEvalCase } from "./evalCase";

export const traceFilterCases: FrontierFilterEvalCase[] = [
  {
    id: "any-error",
    query: "Show me traces that had at least one error.",
    accepted: ["error_count > 0", "error_count >= 1"],
    failureMode:
      "iterates span status instead of using the trace-wide error_count aggregate",
  },
  {
    id: "token-heavy",
    query: "Find traces that used more than 20,000 tokens.",
    accepted: ["token_count_total > 20000"],
    failureMode:
      "invents a token total field or compares one span instead of the trace aggregate",
  },
  {
    id: "high-correctness-clean",
    query: "Show me error-free traces with a correctness score above 0.8.",
    accepted: [
      "trace_annotations['correctness'].score > 0.8 and error_count == 0",
      "error_count == 0 and trace_annotations['correctness'].score > 0.8",
    ],
    failureMode:
      "uses annotations[...] without making the trace annotation grain explicit",
  },
  {
    id: "refund-input-for-user",
    query: "Show me user-alpha’s traces where the input mentions a refund.",
    accepted: [
      "'refund' in input and user.id == 'user-alpha'",
      "user.id == 'user-alpha' and 'refund' in input",
    ],
    failureMode:
      "drops either the input containment clause or the root-span user proxy",
  },
  {
    id: "ok-span-without-parent",
    query: "Show me traces with an OK span that has no parent recorded.",
    accepted: [
      "any(s.parent_span is None and s.status_code == 'OK' for s in spans)",
      "any(s.parent_id is None and s.status_code == 'OK' for s in spans)",
      "any(s.status_code == 'OK' and s.parent_span is None for s in spans)",
      "any(s.status_code == 'OK' and s.parent_id is None for s in spans)",
    ],
    failureMode:
      "uses the stale parent relation name or fails to express rootness inside the spans comprehension",
  },
  {
    id: "idle-delegate",
    query: "Show me traces where a subagent did no LLM work.",
    accepted: [
      "any('subagent' in s.name and s.cumulative_llm_token_count_total == 0 for s in spans)",
      "any(s.cumulative_llm_token_count_total == 0 and 'subagent' in s.name for s in spans)",
    ],
    failureMode:
      "uses trace-wide tokens instead of the cumulative token count for the named span subtree",
  },
  {
    id: "childless-agent",
    query: "Find traces with an agent span that spawned no child spans.",
    accepted: [
      "any(s.span_kind == 'AGENT' and len([c for c in s.children]) == 0 for s in spans)",
      "any(len([c for c in s.children]) == 0 and s.span_kind == 'AGENT' for s in spans)",
    ],
    failureMode:
      "uses a nonexistent child count field instead of the nested children collection",
  },
  {
    id: "tool-fan-out",
    query: "Show me traces where one span launched at least three tools.",
    accepted: [
      "any(len([c for c in s.children if c.span_kind == 'TOOL']) >= 3 for s in spans)",
    ],
    failureMode:
      "counts tool spans trace-wide instead of correlating tool children to one parent span",
  },
  {
    id: "same-name-errored-sibling",
    query:
      "Find traces where a failed span has a same-named sibling, suggesting repeated retries.",
    accepted: [
      "any(s.status_code == 'ERROR' and any(x.name == s.name for x in s.siblings) for s in spans)",
      "any(any(x.name == s.name for x in s.siblings) and s.status_code == 'ERROR' for s in spans)",
    ],
    failureMode:
      "loses the outer-span correlation when comparing a sibling's name",
  },
  {
    id: "error-after-finalize",
    query: "Find traces where an error occurred after finalization.",
    accepted: [
      "max(s.start_time for s in spans if s.status_code == 'ERROR') > max(s.start_time for s in spans if s.name == 'finalize')",
      "max(s.start_time for s in spans if s.status_code == 'ERROR') > max(s.start_time for s in spans if s.name == 'finalization')",
      "any(s.status_code == 'ERROR' and s.start_time > max(x.start_time for x in spans if x.name == 'finalize') for s in spans)",
      "any(s.status_code == 'ERROR' and s.start_time > max(x.start_time for x in spans if x.name == 'finalization') for s in spans)",
      "max(s.start_time for s in spans if s.status_code == 'ERROR') > max(s.start_time for s in spans if 'finalize' in s.name)",
      "max(s.start_time for s in spans if s.status_code == 'ERROR') > max(s.end_time for s in spans if 'finalize' in s.name)",
      "max(s.start_time for s in spans if s.status_code == 'ERROR') > max(s.end_time for s in spans if 'finalization' in s.name)",
    ],
    failureMode:
      "compares unrelated trace fields or adds unsupported sorting instead of filtered reductions",
  },
  {
    id: "dominant-non-root-subtree",
    query:
      "Show me traces over 20,000 tokens where one non-root subtree accounts for more than 80% of all tokens.",
    accepted: [
      "token_count_total > 20000 and max(s.cumulative_llm_token_count_total for s in spans if s.parent_span is not None) > 0.8 * token_count_total",
      "token_count_total > 20000 and max(s.cumulative_llm_token_count_total for s in spans if s.parent_span.name is not None) > 0.8 * token_count_total",
      "max(s.cumulative_llm_token_count_total for s in spans if s.parent_span is not None) > 0.8 * token_count_total and token_count_total > 20000",
      "max(s.cumulative_llm_token_count_total for s in spans if s.parent_span.name is not None) > 0.8 * token_count_total and token_count_total > 20000",
      "token_count_total > 20000 and max(s.cumulative_llm_token_count_total for s in spans if s.parent_id is not None) > 0.8 * token_count_total",
      "max(s.cumulative_llm_token_count_total for s in spans if s.parent_id is not None) > 0.8 * token_count_total and token_count_total > 20000",
      "token_count_total > 20000 and max([s.cumulative_llm_token_count_total for s in spans if s.parent_id is not None]) > 0.8 * token_count_total",
      "token_count_total > 20000 and max([s.cumulative_llm_token_count_total for s in spans if s.parent_span is not None]) > 0.8 * token_count_total",
    ],
    failureMode:
      "uses the stale parent relation name or ignores the requested trace token threshold",
  },
  {
    id: "failed-tool-never-retried",
    query:
      "Show me traces with a failed tool call that was never retried later.",
    accepted: [
      "any(s.span_kind == 'TOOL' and s.status_code == 'ERROR' and not any(x.name == s.name and x.start_time > s.start_time for x in spans) for s in spans)",
      "any(s.status_code == 'ERROR' and s.span_kind == 'TOOL' and not any(x.name == s.name and x.start_time > s.start_time for x in spans) for s in spans)",
    ],
    failureMode:
      "fails to correlate later same-name spans with the failed outer tool span",
  },
  {
    id: "hallucinating-llm-under-subagent",
    query:
      "Show me traces where an LLM under a subagent has a hallucination score above 0.5.",
    accepted: [
      "any(s.span_kind == 'LLM' and 'subagent' in s.parent_span.name and any(a.name == 'hallucination' and a.score > 0.5 for a in s.annotations) for s in spans)",
      "any(s.span_kind == 'LLM' and s.parent_span is not None and 'subagent' in s.parent_span.name and any(a.name == 'hallucination' and a.score > 0.5 for a in s.annotations) for s in spans)",
      "any(s.span_kind == 'LLM' and s.parent_span.name is not None and 'subagent' in s.parent_span.name and any(a.name == 'hallucination' and a.score > 0.5 for a in s.annotations) for s in spans)",
    ],
    failureMode:
      "uses the stale parent relation name or a trace-level annotation accessor for a span annotation",
  },
  {
    id: "expensive-span",
    query: "Show me traces containing a span that cost more than one cent.",
    accepted: [
      "any(sum(d.cost for d in s.cost_details) > 0.01 for s in spans)",
    ],
    failureMode:
      "uses trace total_cost instead of reducing each span's nested cost details",
  },
  {
    id: "tool-under-cron-parent",
    query: "Show me traces where cron-job directly invoked a tool.",
    accepted: [
      "any(s.span_kind == 'TOOL' and s.parent_span.name == 'cron-job' for s in spans)",
      "any(s.parent_span.name == 'cron-job' and s.span_kind == 'TOOL' for s in spans)",
      "any(s.span_kind == 'TOOL' and s.parent_span is not None and s.parent_span.name == 'cron-job' for s in spans)",
      "any(s.span_kind == 'TOOL' and s.parent_span.name is not None and s.parent_span.name == 'cron-job' for s in spans)",
      "any(s.span_kind == 'TOOL' and 'cron-job' in s.parent_span.name for s in spans)",
      "any('cron-job' in s.parent_span.name and s.span_kind == 'TOOL' for s in spans)",
      "any(s.span_kind == 'TOOL' and s.parent_span is not None and 'cron-job' in s.parent_span.name for s in spans)",
    ],
    failureMode:
      "uses the stale parent relation name or searches all ancestors instead of the direct parent",
  },
];
