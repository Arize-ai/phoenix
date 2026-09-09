import json

from preflight import credential_status, live_blockers
from runtime import CONFIG


def test_secret_canaries_are_not_serialized():
    environment = {
        "OPENAI_API_KEY": "CANARY_OPENAI",
        "ANTHROPIC_API_KEY": "CANARY_ANTHROPIC",
        "HF_TOKEN": "CANARY_HF",
        "CODEX_AUTH_JSON_PATH": "/private/auth.json",
    }
    output = json.dumps([credential_status(environment), live_blockers(environment), CONFIG])
    assert "CANARY" not in output
    assert "/private/auth.json" not in output
    assert credential_status(environment) == {"ANTHROPIC_API_KEY": True, "OPENAI_API_KEY": True}


def test_missing_keys_and_unresolved_models_are_explicit():
    failures = live_blockers({})
    assert "Missing OPENAI_API_KEY" in failures
    assert "Missing ANTHROPIC_API_KEY" in failures
    assert CONFIG["models"] == {"claude-code": "opus-5", "codex": "gpt-5.6"}


def test_completeness_schema_and_atif_plugin_available():
    from phoenix.client.harbor import PhoenixJobPlugin
    from phoenix.evals.metrics.completeness import CompletenessEvaluator

    assert PhoenixJobPlugin is not None
    assert set(CompletenessEvaluator.CompletenessInputSchema.model_fields) == {"conversation"}


def test_registry_or_different_wheel_install_cannot_pass_provenance():
    from preflight import installed_from_pin

    expected = "file:///private/runtime/client.whl"
    assert not installed_from_pin({}, expected)
    assert not installed_from_pin({"url": "file:///different/client.whl"}, expected)
    assert installed_from_pin({"url": expected}, expected)
