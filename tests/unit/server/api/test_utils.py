import pytest

from phoenix.server.api.utils import (
    get_aws_full_model_name,
    get_aws_region_prefix,
    match_aws_model_inference_prefix,
)


@pytest.mark.parametrize(
    "region, expected_region_prefix",
    (
        pytest.param(
            "eu-central-1",
            "eu",
            id="eu-central-1",
        ),
        pytest.param(
            "us-east-1",
            "us",
            id="us-east-1",
        ),
        pytest.param(
            "us-gov-east-1",
            "us-gov",
            id="us-gov-east-1",
        ),
        pytest.param(
            "ap-northeast-3",
            "ap",
            id="ap-northeast-3",
        ),
        pytest.param(
            "",
            "",
            id="empty-region",
        ),
        pytest.param(
            "invalid",
            "",
            id="invalid-region",
        ),
    ),
)
def test_get_aws_region_prefix(region: str, expected_region_prefix: str):
    assert get_aws_region_prefix(region) == expected_region_prefix


@pytest.mark.parametrize(
    "model_name, expected_model_prefix",
    (
        pytest.param(
            "global.anthropic.claude-haiku-4-5-20251001-v1:0",
            "global",
            id="global-anthropic",
        ),
        pytest.param(
            "us.amazon.nova-lite-v1:0",
            "us",
            id="us-nova-lite",
        ),
        pytest.param(
            "apac.anthropic.claude-3-7-sonnet-20250219-v1:0",
            "apac",
            id="apac-anthropic",
        ),
        pytest.param(
            "au.anthropic.claude-sonnet-4-5-20250929-v1:0",
            "au",
            id="au-anthropic",
        ),
        pytest.param(
            "eu.twelvelabs.pegasus-1-2-v1:0",
            "eu",
            id="eu-twelvelabs",
        ),
        pytest.param(
            "jp.anthropic.claude-haiku-4-5-20251001-v1:0",
            "jp",
            id="jp-anthropic",
        ),
        pytest.param(
            "us-gov.anthropic.claude-sonnet-4-5-20250929-v1:0",
            "us-gov",
            id="us-gov-anthropic-1",
        ),
        pytest.param(
            "anthropic.claude-sonnet-4-5-20250929-v1:0",
            "",
            id="base-anthropic",
        ),
        pytest.param(
            "",
            "",
            id="empty-model-name",
        ),
        pytest.param(
            "invalid",
            "",
            id="invalid-model-name",
        ),
    ),
)
def test_match_aws_model_inference_prefix(model_name: str, expected_model_prefix: str):
    assert match_aws_model_inference_prefix(model_name) == expected_model_prefix


@pytest.mark.parametrize(
    "model_name, region, expected_full_model_name",
    (
        pytest.param(
            "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
            "eu-central-1",
            "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
            id="eu-anthropic",
        ),
        pytest.param(
            "us.stability.stable-image-style-guide-v1:0",
            "us-west-2",
            "us.stability.stable-image-style-guide-v1:0",
            id="us-stability",
        ),
        pytest.param(
            "anthropic.claude-3-5-sonnet-20240620-v1:0",
            "us-gov-east-1",
            "us-gov.anthropic.claude-3-5-sonnet-20240620-v1:0",
            id="us-gov-anthropic-2",
        ),
        pytest.param(
            "anthropic.claude-sonnet-4-20250514-v1:0",
            "ap-southeast-7",
            "apac.anthropic.claude-sonnet-4-20250514-v1:0",
            id="apac-anthropic",
        ),
        pytest.param(
            "",
            "",
            "",
            id="empty-params",
        ),
        pytest.param(
            "invalid",
            "invalid",
            "invalid",
            id="invalid-params",
        ),
    ),
)
def test_get_aws_full_model_name(model_name: str, region: str, expected_full_model_name: str):
    assert get_aws_full_model_name(model_name, region) == expected_full_model_name
