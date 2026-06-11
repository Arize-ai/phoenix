from phoenix.server.agents.capabilities.tools.external import (
    _EXTERNAL_TOOL_DEFINITIONS_BY_NAME,
    get_external_tool_definition,
    load_dataset,
    open_dataset_evaluator_for_edit,
    read_dataset_evaluator_definition,
    set_appended_messages_path,
    set_dataset_evaluator_selection,
    set_playground_experiment_recording,
    set_template_variables_path,
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

    The browser dispatch resolves these names to IDs, so the advertised
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


def test_set_template_variables_path_instructions_expose_structure_and_load_dataset_nudge() -> None:
    rendered = AgentPrompts().set_template_variables_path_tool.render()

    assert '<tool name="set_template_variables_path">' in rendered
    assert "load_dataset" in rendered


def test_set_template_variables_path_parameters_expose_only_nullable_path() -> None:
    # The browser dispatch resolves ``path`` against the active dataset; this schema is the contract.
    schema = set_template_variables_path.TOOL_DEFINITION.parameters_json_schema

    assert set_template_variables_path.NAME == "set_template_variables_path"
    assert set(schema["properties"]) == {"path"}
    assert schema["required"] == ["path"]
    assert schema["additionalProperties"] is False
    assert schema["properties"]["path"]["type"] == ["string", "null"]


def test_set_appended_messages_path_instructions_expose_tool_tag_and_load_dataset_nudge() -> None:
    """Pin the rendered ``set_appended_messages_path`` instruction structure."""
    rendered = AgentPrompts().set_appended_messages_path_tool.render()

    assert '<tool name="set_appended_messages_path">' in rendered
    assert "load_dataset" in rendered
    # The path is resolved relative to the example's ``input`` object, so the guidance
    # must steer the model away from prefixing the path with ``input.`` (PR 13623 review).
    assert "relative to a dataset example's `input` object" in rendered


def test_set_appended_messages_path_parameters_expose_only_nullable_required_path() -> None:
    """Pin the model-facing parameter contract; must agree with the frontend zod ``.strict()`` parser."""
    schema = set_appended_messages_path.TOOL_DEFINITION.parameters_json_schema

    assert set_appended_messages_path.NAME == "set_appended_messages_path"
    assert set(schema["properties"]) == {"path"}
    assert schema["required"] == ["path"]
    assert schema["additionalProperties"] is False
    assert schema["properties"]["path"]["type"] == ["string", "null"]


def test_set_playground_experiment_recording_instructions_expose_persistence_guidance() -> None:
    rendered = AgentPrompts().set_playground_experiment_recording_tool.render()

    assert '<tool name="set_playground_experiment_recording">' in rendered
    assert "run_playground" in rendered
    assert "save_prompt" in rendered


def test_set_playground_experiment_recording_parameters_expose_recording_flag() -> None:
    schema = set_playground_experiment_recording.TOOL_DEFINITION.parameters_json_schema

    assert set_playground_experiment_recording.NAME == "set_playground_experiment_recording"
    assert set(schema["properties"]) == {"recordExperiments"}
    assert schema["required"] == ["recordExperiments"]
    assert schema["additionalProperties"] is False
    assert schema["properties"]["recordExperiments"]["type"] == "boolean"


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


def test_get_route_info_is_registered_as_external_tool() -> None:
    tool_definition = get_external_tool_definition("get_route_info")

    assert tool_definition is not None
    assert tool_definition.kind == "external"


def test_cancel_playground_run_is_registered_as_external_tool() -> None:
    tool_definition = get_external_tool_definition("cancel_playground_run")

    assert tool_definition is not None
    assert tool_definition.kind == "external"
    assert tool_definition.parameters_json_schema == {
        "type": "object",
        "properties": {},
        "additionalProperties": False,
    }


def test_set_dataset_evaluator_selection_parameters_take_whole_set_of_ids() -> None:
    schema = set_dataset_evaluator_selection.TOOL_DEFINITION.parameters_json_schema

    assert set_dataset_evaluator_selection.NAME == "set_dataset_evaluator_selection"
    assert set(schema["properties"]) == {"datasetEvaluatorIds"}
    assert schema["required"] == ["datasetEvaluatorIds"]
    assert schema["additionalProperties"] is False
    assert schema["properties"]["datasetEvaluatorIds"]["type"] == "array"


def test_open_dataset_evaluator_for_edit_parameters_take_single_id() -> None:
    schema = open_dataset_evaluator_for_edit.TOOL_DEFINITION.parameters_json_schema

    assert open_dataset_evaluator_for_edit.NAME == "open_dataset_evaluator_for_edit"
    assert set(schema["properties"]) == {"datasetEvaluatorId"}
    assert schema["required"] == ["datasetEvaluatorId"]
    assert schema["additionalProperties"] is False
    assert schema["properties"]["datasetEvaluatorId"]["type"] == "string"


def test_read_dataset_evaluator_definition_parameters_take_bounded_id_array() -> None:
    schema = read_dataset_evaluator_definition.TOOL_DEFINITION.parameters_json_schema

    assert read_dataset_evaluator_definition.NAME == "read_dataset_evaluator_definition"
    assert set(schema["properties"]) == {"datasetEvaluatorIds"}
    assert schema["required"] == ["datasetEvaluatorIds"]
    assert schema["additionalProperties"] is False
    ids = schema["properties"]["datasetEvaluatorIds"]
    assert ids["type"] == "array"
    assert ids["minItems"] == 1
    assert ids["maxItems"] == read_dataset_evaluator_definition.MAX_EVALUATOR_IDS


def test_set_dataset_evaluator_selection_instructions_pin_whole_set_contract() -> None:
    rendered = AgentPrompts().set_dataset_evaluator_selection_tool.render()

    assert '<tool name="set_dataset_evaluator_selection">' in rendered
    assert "datasetEvaluatorIds" in rendered


def test_open_dataset_evaluator_for_edit_instructions_pin_builtin_and_collision_guards() -> None:
    rendered = AgentPrompts().open_dataset_evaluator_for_edit_tool.render()

    assert '<tool name="open_dataset_evaluator_for_edit">' in rendered
    assert "datasetEvaluatorId" in rendered
    assert "built-in" in rendered
    assert "close the open form" in rendered


def test_read_dataset_evaluator_definition_instructions_pin_read_only_contract() -> None:
    rendered = AgentPrompts().read_dataset_evaluator_definition_tool.render()

    assert '<tool name="read_dataset_evaluator_definition">' in rendered
    assert "datasetEvaluatorIds" in rendered
    assert "truncated" in rendered
