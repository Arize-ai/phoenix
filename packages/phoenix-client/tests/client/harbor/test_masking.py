# pyright: reportMissingImports=false, reportMissingTypeStubs=false
"""Tests for masking secrets in Harbor data sent to Phoenix."""

from __future__ import annotations

import json

import pytest

pytest.importorskip("harbor", reason="Harbor requires Python >=3.12 and <3.15")

from phoenix.client.harbor._masking import MASKED_SECRET, SecretMasker, collect_secret_values

# Fake keys are assembled at runtime so secret scanners don't flag this file.
FAKE_OPENAI_KEY = "sk-proj-" + "Fake0" * 8
FAKE_ANTHROPIC_KEY = "sk-ant-api03-" + "Fake1" * 8
FAKE_DAYTONA_KEY = "dtn_" + "fake2" * 8


def test_masks_provider_keys_in_a_process_listing() -> None:
    listing = (
        f"timeout 900 env OPENAI_API_KEY={FAKE_OPENAI_KEY} "
        f"ANTHROPIC_API_KEY={FAKE_ANTHROPIC_KEY} bash -c 'claude --print'"
    )

    assert SecretMasker().mask(listing) == (
        f"timeout 900 env OPENAI_API_KEY={MASKED_SECRET} "
        f"ANTHROPIC_API_KEY={MASKED_SECRET} bash -c 'claude --print'"
    )


@pytest.mark.parametrize(
    "key",
    [
        "sk-" + "a1B2c3D4" * 6,
        "sk-proj-" + "a1B2c3D4" * 6,
        "sk-svcacct-" + "a1B2c3D4" * 6,
        "sk-ant-api03-" + "a1B2-c3_D4" * 6,
        "sk-ant-admin01-" + "a1B2-c3_D4" * 6,
    ],
    ids=["openai-legacy", "openai-project", "openai-service-account", "anthropic", "admin"],
)
def test_masks_openai_and_anthropic_key_formats(key: str) -> None:
    assert SecretMasker().mask(f'{{"Authorization": "Bearer {key}"}}') == (
        f'{{"Authorization": "Bearer {MASKED_SECRET}"}}'
    )


@pytest.mark.parametrize(
    "text",
    [
        "task-scheduler-configuration-options",
        "risk-adjusted-performance-measures-2026",
        "sk-short",
    ],
)
def test_leaves_key_like_words_unchanged(text: str) -> None:
    assert SecretMasker().mask(text) == text


def test_masks_known_secret_values_without_a_provider_prefix() -> None:
    masker = SecretMasker([FAKE_DAYTONA_KEY])

    assert masker.mask(f"DAYTONA_API_KEY={FAKE_DAYTONA_KEY}") == (
        f"DAYTONA_API_KEY={MASKED_SECRET}"
    )


def test_masks_a_secret_whole_when_it_contains_another_secret() -> None:
    masker = SecretMasker(["abcdefgh12", "abcdefgh12345678"])

    assert masker.mask("token abcdefgh12345678") == f"token {MASKED_SECRET}"


def test_masks_strings_in_nested_values_and_keeps_other_types() -> None:
    span = {
        "name": "bash",
        "status_code": "ERROR",
        "status_message": f"exit 1: {FAKE_ANTHROPIC_KEY}",
        "attributes": {
            "input.value": json.dumps({"command": f"echo {FAKE_OPENAI_KEY}"}),
            "llm.token_count.prompt": 12,
            "metadata": {FAKE_OPENAI_KEY: [FAKE_OPENAI_KEY, None, True, 0.5]},
        },
        "events": (f"key {FAKE_OPENAI_KEY}",),
    }

    assert SecretMasker().mask(span) == {
        "name": "bash",
        "status_code": "ERROR",
        "status_message": f"exit 1: {MASKED_SECRET}",
        "attributes": {
            "input.value": json.dumps({"command": f"echo {MASKED_SECRET}"}),
            "llm.token_count.prompt": 12,
            "metadata": {MASKED_SECRET: [MASKED_SECRET, None, True, 0.5]},
        },
        "events": (f"key {MASKED_SECRET}",),
    }


def test_collects_only_secret_named_values() -> None:
    values = collect_secret_values(
        environments=[
            {
                "DAYTONA_API_KEY": FAKE_DAYTONA_KEY,
                "GITHUB_TOKEN": "ghp_fake_token_value",
                "PHOENIX_COLLECTOR_ENDPOINT": "https://phoenix.example",
                "SHORT_SECRET": "abc",
            }
        ],
        extra_values=["phoenix-api-key-value", None, ""],
    )

    assert values == {FAKE_DAYTONA_KEY, "ghp_fake_token_value", "phoenix-api-key-value"}


def test_resolves_templates_against_the_process_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BENCHMARK_ANTHROPIC", FAKE_ANTHROPIC_KEY)
    monkeypatch.delenv("UNSET_BENCHMARK_KEY", raising=False)

    values = collect_secret_values(
        environments=[
            {
                "ANTHROPIC_API_KEY": "${BENCHMARK_ANTHROPIC}",
                "OPENAI_API_KEY": "${UNSET_BENCHMARK_KEY}",
            }
        ],
    )

    assert values == {FAKE_ANTHROPIC_KEY}
