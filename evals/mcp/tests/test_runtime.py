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
    assert live_blockers(environment) == []


def test_missing_keys_and_unresolved_models_are_explicit():
    failures = live_blockers({})
    assert "Missing OPENAI_API_KEY" in failures
    assert "Missing ANTHROPIC_API_KEY" in failures
    assert CONFIG["models"] == {"claude-code": "opus-5", "codex": "gpt-5.6"}


def test_native_atif_plugin_available():
    from phoenix.client.harbor import PhoenixJobPlugin

    assert PhoenixJobPlugin is not None


def test_registry_or_different_wheel_install_cannot_pass_provenance():
    from preflight import installed_from_pin

    expected = "file:///private/runtime/client.whl"
    assert not installed_from_pin({}, expected)
    assert not installed_from_pin({"url": "file:///different/client.whl"}, expected)
    assert installed_from_pin({"url": expected}, expected)


def test_preflight_checks_actual_artifacts_and_installed_provenance(tmp_path, monkeypatch):
    import hashlib
    from types import SimpleNamespace

    import preflight

    monkeypatch.setattr(preflight, "HERE", tmp_path)
    monkeypatch.setattr(preflight.importlib.metadata, "version", lambda _: "0.22.0")
    runtime = tmp_path / ".runtime"
    runtime.mkdir()
    (tmp_path / "configs").mkdir()
    wheel = runtime / "arize_phoenix_client-3.4.0-py3-none-any.whl"
    wheel.write_bytes(b"pinned-content")
    checksum = hashlib.sha256(wheel.read_bytes()).hexdigest()
    (runtime / "build.json").write_text(
        json.dumps(
            {
                "phoenix_revision": preflight.CONFIG["phoenix_revision"],
                "wheels": [{"path": str(wheel.relative_to(tmp_path)), "sha256": checksum}],
            }
        )
    )
    (tmp_path / "configs/wheels.json").write_text(json.dumps({wheel.name: checksum}))
    installed = {"url": wheel.as_uri()}
    monkeypatch.setattr(
        preflight.importlib.metadata,
        "distribution",
        lambda _: SimpleNamespace(read_text=lambda _: json.dumps(installed)),
    )
    assert preflight.check_runtime() == []
    wheel.write_bytes(b"changed")
    assert "Wheel missing or checksum mismatch" in preflight.check_runtime()
    installed["url"] = "file:///unreviewed.whl"
    assert any("not installed" in s for s in preflight.check_runtime())
