import type { Completion } from "@codemirror/autocomplete";
import { useDeferredValue, useState } from "react";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import {
  DSLFilterConditionBuilder,
  DSLFilterConditionField,
  type DSLFilterSnippet,
} from "@phoenix/components/filter";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { useSpanFilters } from "./SpanFiltersContext";
import { validateSpanFilterCondition } from "./spanFilterValidation";

/**
 * The vocabulary of the span filter DSL: fields on a span plus macro
 * snippets for common conditions.
 */
const spanFilterCompletions: Completion[] = [
  {
    label: "span_kind",
    type: "variable",
    info: "The span variant: CHAIN, LLM, RETRIEVER, TOOL, etc.",
  },
  {
    label: "status_code",
    type: "variable",
    info: "The span status: OK, UNSET, or ERROR",
  },
  {
    label: "input.value",
    type: "variable",
    info: "The input value of a span, typically a query",
  },
  {
    label: "output.value",
    type: "variable",
    info: "The output value of a span, typically a response",
  },
  {
    label: "name",
    type: "variable",
    info: "The name given to a span - e.x. OpenAI",
  },
  {
    label: "latency_ms",
    type: "variable",
    info: "Latency (i.e. duration) in milliseconds",
  },
  {
    label: "cumulative_token_count.prompt",
    type: "variable",
    info: "Sum of token count for prompt from self and all child spans",
  },
  {
    label: "cumulative_token_count.completion",
    type: "variable",
    info: "Sum of token count for completion from self and all child spans",
  },
  {
    label: "cumulative_token_count.total",
    type: "variable",
    info: "Sum of token count total (prompt + completion) from self and all child spans",
  },
  {
    label: "llm spans",
    type: "text",
    apply: "span_kind == 'LLM'",
    detail: "macro",
  },
  {
    label: "retriever spans",
    type: "text",
    apply: "span_kind == 'RETRIEVER'",
    detail: "macro",
  },
  {
    label: "search input",
    type: "text",
    apply: "'' in input.value",
    detail: "macro",
  },
  {
    label: "search output",
    type: "text",
    apply: "'' in output.value",
    detail: "macro",
  },
  {
    label: "status_code error",
    type: "text",
    apply: "status_code == 'ERROR'",
    detail: "macro",
  },
  {
    label: "Latency >= 10s",
    type: "text",
    apply: "latency_ms >= 10_000",
    detail: "macro",
  },
  {
    label: "Tokens >= 1,000",
    type: "text",
    apply: "llm.token_count.total >= 1_000",
    detail: "macro",
  },
  {
    label: "Hallucinations",
    type: "text",
    apply: "annotations['Hallucination'].label == 'hallucinated'",
    detail: "macro",
  },
  {
    label: "Annotations",
    type: "text",
    apply: "annotations['Hallucination'].label == 'hallucinated'",
    detail: "macro",
  },
  {
    label: "Metadata",
    type: "text",
    apply: "metadata['topic'] == 'agent'",
    detail: "macro",
  },
  {
    label: "Substring",
    type: "text",
    apply: "'agent' in input.value",
    detail: "macro",
  },
];

const spanFilterSnippets: DSLFilterSnippet[] = [
  {
    key: "kind",
    label: "filter by kind",
    snippet: "span_kind == 'LLM'",
  },
  {
    key: "token_count",
    label: "filter by token count",
    snippet: "cumulative_token_count.total > 1000",
  },
  {
    key: "annotation_label",
    label: "filter by annotation label",
    snippet: "annotations['Hallucination'].label == 'hallucinated'",
  },
  {
    key: "eval_label",
    label: "filter by evaluation label",
    snippet: "evals['Hallucination'].label == 'hallucinated'",
  },
  {
    key: "eval_score",
    label: "filter by evaluation score",
    snippet: "evals['Hallucination'].score < 1",
  },
  {
    key: "metadata",
    label: "filter by metadata",
    snippet: "metadata['topic'] == 'agent'",
  },
  {
    key: "substring",
    label: "filter by substring",
    snippet: "'agent' in input.value",
  },
];

type SpanFilterConditionFieldProps = {
  /**
   * Callback when the condition is valid
   */
  onValidCondition: (condition: string) => void;
  placeholder?: string;
};
export function SpanFilterConditionField(props: SpanFilterConditionFieldProps) {
  const {
    onValidCondition,
    placeholder = "filter condition (e.x. span_kind == 'LLM')",
  } = props;
  const [isConditionValid, setIsConditionValid] = useState<boolean>(true);
  const { filterCondition, setFilterCondition, appendFilterCondition } =
    useSpanFilters();
  const deferredFilterCondition = useDeferredValue(filterCondition);

  const projectId = useTracingContext((state) => state.projectId);

  // Advertise a project context that carries the current spanFilter while
  // the field is mounted. The merge in `selectActiveContexts` layers this
  // on top of the route-derived project context (which carries no filter)
  // so the server sees a single project entry with the filter included.
  // An in-progress invalid edit surfaces as empty rather than a known-bad
  // expression.
  let advertisedContext: AgentContext | null = null;
  if (projectId) {
    const trimmed = deferredFilterCondition.trim();
    const spanFilter = isConditionValid && trimmed ? trimmed : "";
    advertisedContext = {
      type: "project",
      projectNodeId: projectId,
      spanFilter,
    };
  }

  // Keep the agent's mounted UI context aligned with the current validated
  // filter expression while this field is rendered. The matching agent
  // client action for `set_spans_filter` is registered by
  // `SpanFiltersProvider`, which owns the underlying state.
  useAdvertiseAgentContext(advertisedContext);

  return (
    <DSLFilterConditionField
      className="span-filter-condition-field"
      value={filterCondition}
      onChange={setFilterCondition}
      placeholder={placeholder}
      completions={spanFilterCompletions}
      validateCondition={(condition) =>
        validateSpanFilterCondition(condition, projectId)
      }
      onValidCondition={onValidCondition}
      onValidationStateChange={setIsConditionValid}
      builder={
        <DSLFilterConditionBuilder
          snippets={spanFilterSnippets}
          onAddCondition={appendFilterCondition}
        />
      }
    />
  );
}
