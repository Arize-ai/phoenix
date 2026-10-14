import json
import logging
from datetime import datetime, timezone
from typing import Any

import pytest

from phoenix.server.cost_tracking.manifest import (
    SUPPORTED_SCHEMA_VERSION,
    ManifestError,
    parse_manifest,
)


def _model(name: str, **overrides: Any) -> dict[str, Any]:
    return {
        "name": name,
        "name_pattern": name,
        "source": "litellm",
        "token_prices": [
            {"base_rate": 1e-6, "is_prompt": True, "token_type": "input"},
            {"base_rate": 2e-6, "is_prompt": False, "token_type": "output"},
        ],
        **overrides,
    }


def _manifest(**overrides: Any) -> dict[str, Any]:
    return {
        "schema_version": SUPPORTED_SCHEMA_VERSION,
        "generated_at": "2026-10-14T12:00:00Z",
        "models": [_model("model-a"), _model("model-b")],
        **overrides,
    }


def test_parses_valid_manifest() -> None:
    data = _manifest(
        models=[
            _model(
                "model-a",
                provider="openai",
                token_prices=[
                    {
                        "base_rate": 1e-6,
                        "is_prompt": True,
                        "token_type": "input",
                        "customization": {
                            "type": "threshold_based",
                            "key": "llm.token_count.prompt",
                            "threshold": 200000.0,
                            "new_rate": 2e-6,
                        },
                    },
                ],
            ),
            _model("model-b"),
        ]
    )
    manifest = parse_manifest(json.dumps(data).encode())
    assert manifest.schema_version == SUPPORTED_SCHEMA_VERSION
    assert manifest.generated_at == datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
    assert [model.name for model in manifest.models] == ["model-a", "model-b"]
    model_a = manifest.models[0]
    assert model_a.provider == "openai"
    assert model_a.name_pattern.pattern == "model-a"
    assert model_a.token_prices[0].customization == {
        "type": "threshold_based",
        "key": "llm.token_count.prompt",
        "threshold": 200000.0,
        "new_rate": 2e-6,
    }
    assert manifest.models[1].provider is None


def test_accepts_str_and_converts_generated_at_to_utc() -> None:
    manifest = parse_manifest(json.dumps(_manifest(generated_at="2026-10-14T14:00:00+02:00")))
    assert manifest.generated_at == datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
    assert manifest.generated_at.utcoffset() == timezone.utc.utcoffset(None)


@pytest.mark.parametrize("schema_version", [SUPPORTED_SCHEMA_VERSION + 1, 0, "1", True, None])
def test_rejects_unsupported_schema_version(schema_version: Any) -> None:
    with pytest.raises(ManifestError, match="schema_version"):
        parse_manifest(json.dumps(_manifest(schema_version=schema_version)))


def test_rejects_missing_schema_version() -> None:
    data = _manifest()
    del data["schema_version"]
    with pytest.raises(ManifestError, match="missing schema_version"):
        parse_manifest(json.dumps(data))


def test_rejects_missing_generated_at() -> None:
    data = _manifest()
    del data["generated_at"]
    with pytest.raises(ManifestError, match="missing generated_at"):
        parse_manifest(json.dumps(data))


@pytest.mark.parametrize(
    "generated_at",
    [
        pytest.param("not a date", id="garbage"),
        pytest.param("2026-10-14T12:00:00", id="naive"),
        pytest.param(None, id="null"),
    ],
)
def test_rejects_invalid_generated_at(generated_at: Any) -> None:
    with pytest.raises(ManifestError, match="generated_at"):
        parse_manifest(json.dumps(_manifest(generated_at=generated_at)))


@pytest.mark.parametrize(
    "data",
    [
        pytest.param(b"{not json", id="malformed"),
        pytest.param(b"\xff\xfe\xfa", id="not-utf8"),
        pytest.param(b"", id="empty"),
    ],
)
def test_rejects_invalid_json(data: bytes) -> None:
    with pytest.raises(ManifestError, match="not valid JSON"):
        parse_manifest(data)


@pytest.mark.parametrize("data", ["[]", '"manifest"', json.dumps(_manifest(models={}))])
def test_rejects_wrong_shape(data: str) -> None:
    with pytest.raises(ManifestError):
        parse_manifest(data)


def test_rejected_manifest_does_not_warn_about_entries(caplog: pytest.LogCaptureFixture) -> None:
    data = _manifest(schema_version=SUPPORTED_SCHEMA_VERSION + 1, models=[{"name": "bad"}])
    with caplog.at_level(logging.WARNING), pytest.raises(ManifestError):
        parse_manifest(json.dumps(data))
    assert not caplog.records


@pytest.mark.parametrize(
    "bad_entry, expected_label",
    [
        pytest.param(
            {k: v for k, v in _model("bad").items() if k != "token_prices"},
            "'bad'",
            id="missing-token-prices",
        ),
        pytest.param(
            {k: v for k, v in _model("bad").items() if k != "name_pattern"},
            "'bad'",
            id="missing-name-pattern",
        ),
        pytest.param(_model("bad", name_pattern="bad("), "'bad'", id="invalid-regex"),
        pytest.param(_model("   "), "at index 1", id="blank-name"),
        pytest.param(
            _model("bad", token_prices=[{"base_rate": 1e-6, "token_type": "input"}]),
            "'bad'",
            id="token-price-missing-is-prompt",
        ),
        pytest.param(
            _model(
                "bad",
                token_prices=[{"base_rate": -1, "is_prompt": True, "token_type": "input"}],
            ),
            "'bad'",
            id="negative-rate",
        ),
        pytest.param("not an object", "at index 1", id="not-an-object"),
    ],
)
def test_skips_invalid_entry_and_keeps_the_rest(
    bad_entry: Any,
    expected_label: str,
    caplog: pytest.LogCaptureFixture,
) -> None:
    data = _manifest(models=[_model("model-a"), bad_entry, _model("model-b")])
    with caplog.at_level(logging.WARNING):
        manifest = parse_manifest(json.dumps(data))
    assert [model.name for model in manifest.models] == ["model-a", "model-b"]
    warnings = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 1
    assert f"Skipping model {expected_label}" in warnings[0]


def test_reports_names_of_skipped_entries() -> None:
    invalid_rate = [{"base_rate": -1, "is_prompt": True, "token_type": "input"}]
    data = _manifest(
        models=[
            _model("model-a"),
            _model(" bad ", token_prices=invalid_rate),
            _model("model-b", token_prices=invalid_rate),
            _model("model-b"),
            _model("   ", token_prices=invalid_rate),
            "not an object",
        ]
    )
    manifest = parse_manifest(json.dumps(data))
    assert [model.name for model in manifest.models] == ["model-a", "model-b"]
    # model-b also has a valid entry, so it isn't reported; blank names can't be.
    assert manifest.skipped_model_names == {"bad"}
    assert "skipped_model_names" not in manifest.model_dump()


def test_ignores_unknown_fields() -> None:
    data = _manifest(
        future_top_level_field={"anything": True},
        models=[
            _model(
                "model-a",
                max_input_tokens=200_000,
                token_prices=[
                    {
                        "base_rate": 1e-6,
                        "is_prompt": True,
                        "token_type": "input",
                        "future_token_price_field": "x",
                    }
                ],
            )
        ],
    )
    manifest = parse_manifest(json.dumps(data))
    assert [model.name for model in manifest.models] == ["model-a"]
    assert not hasattr(manifest, "future_top_level_field")
    assert not hasattr(manifest.models[0], "max_input_tokens")
