from __future__ import annotations

import pytest

from phoenix.db.types.prompts import (
    PromptAnthropicInvocationParameters,
    PromptAnthropicInvocationParametersContent,
    PromptAnthropicThinkingConfigEnabled,
    PromptAwsInvocationParameters,
    PromptAwsInvocationParametersContent,
    PromptGoogleInvocationParameters,
    PromptGoogleInvocationParametersContent,
)


def test_anthropic_thinking_and_stop_sequences_round_trip() -> None:
    params = PromptAnthropicInvocationParameters(
        type="anthropic",
        anthropic=PromptAnthropicInvocationParametersContent(
            max_tokens=2048,
            stop_sequences=["###"],
            thinking=PromptAnthropicThinkingConfigEnabled(type="enabled", budget_tokens=1024),
        ),
    )
    loaded = PromptAnthropicInvocationParameters.model_validate(params.model_dump())
    assert loaded.anthropic.thinking.type == "enabled"
    assert loaded.anthropic.stop_sequences == ["###"]


def test_anthropic_enabled_thinking_budget_validation() -> None:
    with pytest.raises(ValueError, match="thinking budget"):
        PromptAnthropicInvocationParametersContent(
            max_tokens=1000,
            thinking=PromptAnthropicThinkingConfigEnabled(type="enabled", budget_tokens=1500),
        )


def test_google_stop_sequences_optional() -> None:
    params = PromptGoogleInvocationParameters(
        type="google",
        google=PromptGoogleInvocationParametersContent(
            temperature=0.7,
            stop_sequences=["."],
        ),
    )
    loaded = PromptGoogleInvocationParameters.model_validate(params.model_dump())
    assert loaded.google.stop_sequences == ["."]


def test_aws_invocation_parameters_optional_fields() -> None:
    params = PromptAwsInvocationParameters(
        type="aws",
        aws=PromptAwsInvocationParametersContent(
            max_tokens=500,
        ),
    )
    loaded = PromptAwsInvocationParameters.model_validate(params.model_dump())
    assert loaded.aws.max_tokens == 500
