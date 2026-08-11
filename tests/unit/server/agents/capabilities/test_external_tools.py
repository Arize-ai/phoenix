from phoenix.server.agents.capabilities.tools.external import (
    _EXTERNAL_TOOL_DEFINITIONS_BY_NAME,
    get_external_tool_definition,
    patch_experiment,
)
from phoenix.server.agents.prompts import AgentPrompts


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


def test_patch_experiment_parameters_require_only_experiment_id() -> None:
    """Pin the model-facing parameter contract: registered as an external tool,
    ``experimentId`` required, the rest optional, and no top-level combinators."""
    tool_definition = get_external_tool_definition("patch_experiment")
    assert tool_definition is not None
    assert tool_definition.kind == "external"
    assert patch_experiment.NAME == "patch_experiment"

    schema = patch_experiment.TOOL_DEFINITION.parameters_json_schema
    assert schema["type"] == "object"
    assert schema["required"] == ["experimentId"]
    assert set(schema["properties"]) == {
        "experimentId",
        "name",
        "description",
        "metadata",
    }
    # description is the only nullable field; metadata is a plain object (whole replace).
    assert schema["properties"]["description"]["type"] == ["string", "null"]
    assert schema["properties"]["metadata"]["type"] == "object"
    assert schema["additionalProperties"] is False


def test_patch_experiment_instructions_teach_metadata_conventions() -> None:
    """Guard the load-bearing facts in the rendered patch_experiment instructions,
    not their exact wording, so the prose can be reworded without breaking the test.

    The template must keep teaching the metadata conventions the agent relies on to
    edit an experiment safely; each assertion below pins one of those facts.
    """
    rendered = AgentPrompts().patch_experiment_tool.render()

    # Renders the patch_experiment tool block.
    assert '<tool name="patch_experiment">' in rendered
    # Teaches recording findings under an appended ``observations`` array.
    assert "observations" in rendered
    # Warns that metadata is replaced "as a whole" (no deep merge) — the key foot-gun.
    assert "as a whole" in rendered
    # Stays off the earlier "lab notebook" metaphor we deliberately dropped.
    assert "lab notebook" not in rendered.lower()


def test_get_route_info_is_registered_as_external_tool() -> None:
    tool_definition = get_external_tool_definition("get_route_info")

    assert tool_definition is not None
    assert tool_definition.kind == "external"
