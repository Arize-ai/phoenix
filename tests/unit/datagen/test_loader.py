from pathlib import Path

from phoenix.datagen import load_scenario


def test_load_scenario_parses_local_fixture() -> None:
    scenario_path = Path(__file__).parent / "fixtures" / "scenario"

    scenario = load_scenario(scenario_path)

    assert scenario.manifest["scenario"] == "synthetic-chat"
    assert len(scenario.requests) == 3
    assert (
        sum(
            len(scope_spans.spans)
            for request in scenario.requests
            for resource_spans in request.resource_spans
            for scope_spans in resource_spans.scope_spans
        )
        == 4
    )


def test_load_scenario_parses_bundled_scenarios() -> None:
    for source in ("langchain_agent_rag", "openai_chat_sessions"):
        scenario = load_scenario(source)

        assert len(scenario.requests) == scenario.manifest["trace_count"]
        assert (
            sum(
                len(scope_spans.spans)
                for request in scenario.requests
                for resource_spans in request.resource_spans
                for scope_spans in resource_spans.scope_spans
            )
            == scenario.manifest["span_count"]
        )
