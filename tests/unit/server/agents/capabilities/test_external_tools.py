from phoenix.server.agents.capabilities.tools.external import (
    _EXTERNAL_TOOL_DEFINITIONS_BY_NAME,
    get_external_tool_definition,
    load_dataset,
    open_dataset_evaluator_for_edit,
    patch_experiment,
    read_dataset_evaluator_definition,
    run_code_evaluator_draft,
    run_llm_evaluator_draft,
    set_appended_messages_path,
    set_dataset_evaluator_selection,
    set_playground_experiment_recording,
    set_template_variables_path,
)
from phoenix.server.agents.capabilities.tools.external.evaluator_draft_preview import (
    MAX_PREVIEW_CASES,
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
    assert set(schema["properties"]) == {
        "recordExperiments",
        "experimentName",
        "experimentDescription",
        "experimentMetadata",
    }
    assert schema["required"] == ["recordExperiments"]
    assert schema["additionalProperties"] is False
    assert schema["properties"]["recordExperiments"]["type"] == "boolean"
    assert schema["properties"]["experimentName"]["type"] == "string"
    assert schema["properties"]["experimentDescription"]["type"] == "string"
    assert schema["properties"]["experimentMetadata"]["type"] == "object"


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


def test_cancel_playground_run_is_registered_as_external_tool() -> None:
    tool_definition = get_external_tool_definition("cancel_playground_run")

    assert tool_definition is not None
    assert tool_definition.kind == "external"
    assert tool_definition.parameters_json_schema == {
        "type": "object",
        "properties": {},
        "additionalProperties": False,
    }


def test_evaluator_draft_preview_tools_share_a_bounded_named_case_contract() -> None:
    code_schema = run_code_evaluator_draft.TOOL_DEFINITION.parameters_json_schema
    llm_schema = run_llm_evaluator_draft.TOOL_DEFINITION.parameters_json_schema

    assert code_schema == llm_schema
    # Equal in content, but independently owned: mutating one tool's schema
    # must never silently corrupt the other's.
    assert code_schema is not llm_schema
    assert code_schema["properties"]["cases"] is not llm_schema["properties"]["cases"]
    assert code_schema.get("required", []) == []
    assert set(code_schema["properties"]) == {"cases"}
    assert code_schema["additionalProperties"] is False
    cases = code_schema["properties"]["cases"]
    assert cases["minItems"] == 1
    assert cases["maxItems"] == MAX_PREVIEW_CASES
    case = cases["items"]
    assert case["required"] == ["id", "testPayload"]
    assert case["properties"]["id"]["minLength"] == 1
    assert set(case["properties"]["testPayload"]["properties"]) == {
        "input",
        "output",
        "reference",
        "metadata",
    }


def test_evaluator_draft_preview_instructions_prefer_one_non_mutating_batch() -> None:
    prompts = AgentPrompts()
    for rendered in (
        prompts.test_code_evaluator_draft_tool.render(),
        prompts.test_llm_evaluator_draft_tool.render(),
    ):
        assert "one `cases` call" in rendered
        assert "does not change the form" in rendered
        assert "does not require edit approval" in rendered
        assert "Omit `cases`" in rendered


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
