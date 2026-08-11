import type { FrontierFilterEvalCase } from "./evalCase";

export const sessionFilterCases: FrontierFilterEvalCase[] = [
  {
    id: "turn-proxy-num-traces",
    query: "sessions with more than 4 conversation turns",
    accepted: ["num_traces > 4"],
    failureMode:
      "invents num_turns instead of using num_traces as the documented turn proxy",
  },
  {
    id: "trace-error-count",
    query: "sessions with at least one trace containing an error",
    accepted: ["num_traces_with_error > 0", "num_traces_with_error >= 1"],
    failureMode:
      "invents error_count or tests a span-level status field at session scope",
  },
  {
    id: "session-total-cost",
    query: "sessions that cost more than $0.75 in total",
    accepted: ["total_cost > 0.75"],
    failureMode: "invents cost or cost_usd instead of using total_cost",
  },
  {
    id: "duration-seconds-to-ms",
    query: "sessions longer than 12 seconds",
    accepted: ["duration_ms > 12000", "duration_ms > 12_000"],
    failureMode:
      "compares duration_ms to 12 without converting seconds to milliseconds",
  },
  {
    id: "p95-latency-frontier",
    query: "sessions whose p95 span latency is above 750 milliseconds",
    accepted: [
      "max(span.latency_ms for span in spans) > 750",
      "any(span.latency_ms > 750 for span in spans)",
    ],
    failureMode:
      "invents latency_p95_ms instead of using the closest expressible span-latency reduction",
    missingCapability:
      "a percentile aggregate over span latency; max span latency is the closest current approximation",
  },
  {
    id: "tool-call-count",
    query: "sessions with more than 3 tool calls",
    accepted: ["tool_span_count > 3"],
    failureMode:
      "invents num_tool_calls or tool_call_count instead of using tool_span_count",
  },
  {
    id: "metadata-key-verbatim",
    query: "sessions where metadata key deployment_ring is canary",
    accepted: [
      "metadata['deployment_ring'] == 'canary'",
      'metadata["deployment_ring"] == "canary"',
      "metadata[\"deployment_ring\"] == 'canary'",
    ],
    failureMode:
      "substitutes a guessed key such as env or environment for deployment_ring",
  },
  {
    id: "annotation-negative-label",
    query: "sessions whose correctness annotation label is incorrect",
    accepted: [
      "annotations['correctness'].label == 'incorrect'",
      'annotations["correctness"].label == "incorrect"',
      "annotations[\"correctness\"].label == 'incorrect'",
      "any(annotation.name == 'correctness' and annotation.label == 'incorrect' for annotation in session_annotations)",
      "any(annotation.label == 'incorrect' and annotation.name == 'correctness' for annotation in session_annotations)",
    ],
    failureMode:
      "uses != 'correct', which also matches labels other than incorrect and excludes nulls differently",
  },
  {
    id: "start-date-offset-boundary",
    query:
      "sessions starting on or after July 10, 2026 at midnight New York time",
    accepted: [
      "start_time >= '2026-07-10T00:00:00-04:00'",
      'start_time >= "2026-07-10T00:00:00-04:00"',
      "start_time >= '2026-07-10T04:00:00+00:00'",
      "start_time >= '2026-07-10T04:00:00Z'",
    ],
    failureMode:
      "drops the inclusive boundary, shifts the date, or omits the UTC offset",
  },
  {
    id: "root-input-content-search",
    query:
      'sessions where any root input contains the exact phrase "refund ledger"',
    accepted: ["'refund ledger' in any_input", '"refund ledger" in any_input'],
    failureMode:
      "invents a messages field or abstains instead of using any_input containment",
  },
  {
    id: "trace-error-ratio",
    query: "sessions where more than 25% of traces contain an error",
    accepted: [
      "num_traces_with_error / num_traces > 0.25",
      "num_traces_with_error > num_traces * 0.25",
      "num_traces_with_error > 0.25 * num_traces",
      "num_traces > 0 and (num_traces_with_error / num_traces > 0.25)",
      "num_traces > 0 and num_traces_with_error / num_traces > 0.25",
      "num_traces > 0 and (num_traces_with_error / num_traces) > 0.25",
      "num_traces > 0 and num_traces_with_error > 0.25 * num_traces",
    ],
    failureMode: "does not compare the two session aggregates arithmetically",
  },
  {
    id: "any-span-name",
    query: "sessions containing any span named vector_lookup",
    accepted: ["any(span.name == 'vector_lookup' for span in spans)"],
    failureMode:
      "uses a bare span field at session scope or omits the any comprehension",
  },
  {
    id: "guarded-all-span-latency",
    query:
      "sessions that contain spans and where every span is faster than 1800 milliseconds",
    accepted: [
      "len([span for span in spans]) > 0 and all(span.latency_ms < 1800 for span in spans)",
      "all(span.latency_ms < 1800 for span in spans) and len([span for span in spans]) > 0",
    ],
    failureMode:
      "uses all without a non-empty guard, causing sessions with no spans to match vacuously",
  },
];
