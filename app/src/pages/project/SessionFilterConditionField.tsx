import type { Completion } from "@codemirror/autocomplete";

import { FilterConditionField } from "@phoenix/components/filter";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { useSessionFilters } from "./SessionFiltersContext";
import { validateSessionFilterCondition } from "./sessionFilterValidation";

export type SessionFilterVocabularyTerm = {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly category: string;
};

function getCompletionOption(term: SessionFilterVocabularyTerm): Completion {
  return {
    label: term.name,
    type: term.type,
    detail: term.category,
    info: term.description,
  };
}

type SessionFilterConditionFieldProps = {
  onValidCondition: (condition: string) => void;
  vocabulary: readonly SessionFilterVocabularyTerm[];
  placeholder?: string;
};

export function SessionFilterConditionField(
  props: SessionFilterConditionFieldProps
) {
  const {
    onValidCondition,
    vocabulary,
    placeholder = "Filter sessions by condition",
  } = props;
  const { filterCondition, setFilterCondition } = useSessionFilters();
  const projectId = useTracingContext((state) => state.projectId);

  // Session filters cannot yet be advertised through AgentContext: the shared
  // project context contract only exposes `spanFilter`. Reusing that field
  // would describe this session expression as a span expression to PXI.
  return (
    <FilterConditionField
      ariaLabel="Session filter condition"
      className="session-filter-condition-field"
      clearAriaLabel="Clear session filter condition"
      completions={vocabulary.map(getCompletionOption)}
      onChange={setFilterCondition}
      onValidCondition={onValidCondition}
      getValidatedCondition={(condition) => (condition.trim() ? condition : "")}
      placeholder={placeholder}
      validateCondition={(condition) =>
        validateSessionFilterCondition(condition, projectId)
      }
      validationKey={projectId}
      value={filterCondition}
    />
  );
}
