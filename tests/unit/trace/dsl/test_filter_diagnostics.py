"""Advisory diagnostics for filter conditions.

`collect_filter_condition_warnings` powers the amber "did you mean span_kind?"
nudge in the filter field and the filter-aware empty state. It exists to catch
the schemaless footgun: a bare identifier such as `kind` is *valid* and runs,
but silently resolves to `attributes['kind']` and so matches nothing. These
tests pin the contract -- which shapes warn, which don't, and that the copy
names the identifier and (when close) a real field.
"""

import pytest

from phoenix.trace.dsl.filter import (
    _BARE_FIELD_NAMES,
    FilterConditionWarning,
    _suggest_field,
    collect_filter_condition_warnings,
)


def _warned_identifiers(condition: str) -> set[str]:
    return {w.identifier for w in collect_filter_condition_warnings(condition)}


class TestBareIdentifierWarnings:
    @pytest.mark.parametrize(
        "condition,identifier",
        [
            ("kind == 'AGENT'", "kind"),
            ("latency > 100", "latency"),
            ("stat_code == 'OK'", "stat_code"),
            ("duration > 5", "duration"),
            ("topic == 'x'", "topic"),
            # The bare identifier warns even when buried in a boolean tree.
            ("span_kind == 'LLM' and kind == 'AGENT'", "kind"),
            ("not (kind == 'AGENT')", "kind"),
        ],
    )
    def test_unknown_bare_identifier_warns(self, condition: str, identifier: str) -> None:
        assert identifier in _warned_identifiers(condition)

    @pytest.mark.parametrize(
        "condition",
        [
            # Real bare fields never warn.
            "span_kind == 'LLM'",
            "status_code == 'OK'",
            "latency_ms > 100",
            "name == 'foo'",
            "span_id == 'abc'",
            "trace_id == 'abc'",
            "parent_id is None",
            "cumulative_llm_token_count_total > 5",
            # `parent_span` is a reserved keyword, not a stray field.
            "parent_span is None",
            "parent_span is not None",
            # Chain roots are the intended way to reach schemaless data.
            "attributes['kind'] == 'AGENT'",
            "metadata['topic'] == 'x'",
            "annotations['quality'].score >= 0.5",
            "llm.model_name == 'gpt-4'",
            "llm.token_count.total > 5",
            # Casts are not field references.
            "float(latency_ms) > 1.0",
            "str(span_kind) == 'LLM'",
        ],
    )
    def test_known_or_structured_forms_do_not_warn(self, condition: str) -> None:
        assert collect_filter_condition_warnings(condition) == []

    @pytest.mark.parametrize(
        "condition",
        [
            "",
            "   ",
            # Invalid conditions are owned by the error path, not by warnings.
            "kind ==",
            "== 'AGENT'",
            "span_kind =!= 'LLM'",
        ],
    )
    def test_empty_or_invalid_conditions_yield_no_warnings(self, condition: str) -> None:
        assert collect_filter_condition_warnings(condition) == []

    def test_each_unknown_identifier_reported_once(self) -> None:
        warnings = collect_filter_condition_warnings(
            "kind == 'AGENT' or kind == 'TOOL' or foo == 'bar'"
        )
        identifiers = [w.identifier for w in warnings]
        assert sorted(identifiers) == ["foo", "kind"]

    def test_warning_message_names_identifier_and_attribute_path(self) -> None:
        (warning,) = collect_filter_condition_warnings("kind == 'AGENT'")
        assert isinstance(warning, FilterConditionWarning)
        assert "`kind`" in warning.message
        assert "attributes['kind']" in warning.message


class TestSuggestions:
    @pytest.mark.parametrize(
        "identifier,suggestion",
        [
            ("kind", "span_kind"),
            ("latency", "latency_ms"),
            ("stat_code", "status_code"),
        ],
    )
    def test_close_identifier_suggests_field(self, identifier: str, suggestion: str) -> None:
        assert _suggest_field(identifier) == suggestion
        (warning,) = collect_filter_condition_warnings(f"{identifier} == 'x'")
        assert warning.suggestion == suggestion
        assert f"`{suggestion}`" in warning.message

    @pytest.mark.parametrize("identifier", ["duration", "topic", "id", "xyzzy"])
    def test_unrelated_identifier_offers_no_suggestion(self, identifier: str) -> None:
        assert _suggest_field(identifier) is None

    def test_every_suggestion_is_a_real_bare_field(self) -> None:
        for identifier in ["kind", "latency", "stat_code", "duration", "topic"]:
            suggestion = _suggest_field(identifier)
            assert suggestion is None or suggestion in _BARE_FIELD_NAMES
