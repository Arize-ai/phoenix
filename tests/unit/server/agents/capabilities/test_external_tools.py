from phoenix.server.agents.capabilities.tools.external import (
    _EXTERNAL_TOOL_DEFINITIONS_BY_NAME,
    load_dataset,
)
from phoenix.server.agents.prompts import AgentPrompts


def test_load_dataset_instructions_expose_params_and_discovery_preflight() -> None:
    """Pin the rendered ``load_dataset`` instruction structure, not its prose.

    The template must name both parameters and carry a ``<preflight>`` block that
    routes name discovery through ``phoenix-gql`` rather than baking dataset
    inventory into the static prompt.
    """
    rendered = AgentPrompts().load_dataset_tool.render()

    assert '<tool name="load_dataset">' in rendered
    assert "datasetName" in rendered
    assert "splitName" in rendered
    assert "<preflight>" in rendered
    assert "phoenix-gql" in rendered


def test_load_dataset_parameters_expose_only_dataset_name_and_optional_split_name() -> None:
    """Pin the ``load_dataset`` model-facing parameter contract.

    The browser dispatch (Phase 2) resolves these names to IDs, so the advertised
    schema is the integration contract: ``datasetName`` is a required string and
    ``splitName`` is an optional, nullable string. Nothing else is accepted.
    """
    schema = load_dataset.TOOL_DEFINITION.parameters_json_schema

    assert load_dataset.NAME == "load_dataset"
    assert set(schema["properties"]) == {"datasetName", "splitName"}
    assert schema["required"] == ["datasetName"]
    assert schema["additionalProperties"] is False
    assert schema["properties"]["datasetName"]["type"] == "string"
    assert schema["properties"]["splitName"]["type"] == ["string", "null"]


def test_external_tool_schemas_avoid_provider_rejected_top_level_keywords() -> None:
    """Keep external tool schemas compatible with strict function-tool providers.

    Some providers reject schemas whose top-level parameters object uses JSON Schema
    combinators such as anyOf/allOf/oneOf. Tool-specific validation can still happen
    in nested properties or in the execution layer, but the top-level shape must stay
    a plain object so every configured model can accept the advertised tool list.
    """
    for tool_definition in _EXTERNAL_TOOL_DEFINITIONS_BY_NAME.values():
        schema = tool_definition.parameters_json_schema

        assert schema["type"] == "object"
        assert "oneOf" not in schema
        assert "anyOf" not in schema
        assert "allOf" not in schema
        assert "not" not in schema
