import pytest

from phoenix.server.evaluators.runtime.base import RenderedMessageTooLargeError


@pytest.mark.parametrize(
    "num_bytes, max_bytes, expected_sizes",
    [
        pytest.param(89_859, 65_536, "87.8 KB, over the 64 KB limit", id="kilobytes"),
        pytest.param(65_537, 65_536, "64.1 KB, over the 64 KB limit", id="one-byte-over"),
        pytest.param(1_500, 1_499, "1.5 KB, over the 1.4 KB limit", id="limit-rounds-down"),
        pytest.param(5_000_000, 65_536, "4.8 MB, over the 64 KB limit", id="megabytes"),
    ],
)
def test_over_limit_states_sizes_and_how_to_fix(
    num_bytes: int, max_bytes: int, expected_sizes: str
) -> None:
    error = RenderedMessageTooLargeError.over_limit(
        subject="The filled-in prompt is",
        num_bytes=num_bytes,
        max_bytes=max_bytes,
        remediation="Shorten the template.",
    )
    assert str(error) == (
        f"The filled-in prompt is {expected_sizes}. Shorten the template. "
        "To raise the limit, set PHOENIX_ONLINE_EVAL_MAX_LLM_MESSAGE_BYTES."
    )
