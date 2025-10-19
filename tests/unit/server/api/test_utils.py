import pytest

from phoenix.server.api.utils import get_aws_model_inference_prefix


@pytest.mark.parametrize(
    "region, expected_model_inference_prefix",
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
            "ap-northeast-3",
            "apac",
            id="ap-northeast-3",
        ),
        pytest.param(
            "",
            "",
            id="empty-region",
        ),
        pytest.param(
            "invalid",
            "invalid",
            id="invalid-region",
        ),
    ),
)
def test_get_aws_model_inference_prefix(region: str, expected_model_inference_prefix: str):
    assert get_aws_model_inference_prefix(region) == expected_model_inference_prefix
