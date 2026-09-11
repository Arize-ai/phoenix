from fastapi import FastAPI

from phoenix.server.api.routers.v1.evaluators import router


def test_evaluator_definition_schema() -> None:
    app = FastAPI()
    app.include_router(router)
    schema = app.openapi()
    for method in ("get", "patch"):
        response = schema["paths"]["/evaluators/{evaluator_id}"][method]["responses"]["200"]
        assert response["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/EvaluatorDefinitionResponseBody"
        }
    schemas = schema["components"]["schemas"]
    assert (
        schemas["LLMEvaluatorDefinition"]["properties"]["output_configs"]["items"]
        == (schemas["PatchLLMEvaluatorRequest"]["properties"]["output_configs"]["items"])
    )
    assert schemas["LLMEvaluatorDefinition"]["properties"]["output_configs"]["items"] == {
        "$ref": "#/components/schemas/CategoricalAnnotationConfigData"
    }
    assert "EvaluatorPromptVersion" not in schemas
    for name in ("LLMEvaluatorDefinition", "PatchLLMEvaluatorRequest"):
        prompt_schema = schemas[name]["properties"]["prompt_version"]
        assert {"$ref": "#/components/schemas/PromptVersionData"} in prompt_schema.get(
            "anyOf", [prompt_schema]
        )
