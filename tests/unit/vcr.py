import re
from typing import Any

import vcr  # type: ignore[import-untyped]
from pytest import FixtureRequest
from vcr.cassette import Cassette  # type: ignore[import-untyped]


class CustomVCR(vcr.VCR):  # type: ignore[misc]
    def __init__(
        self,
        request: FixtureRequest,
        **kwargs: Any,
    ) -> None:
        self._request = request
        super().__init__(
            **{
                "record_mode": "once",
                "decode_compressed_response": True,
                "before_record_request": remove_request_headers,
                "before_record_response": remove_response_headers,
                "ignore_hosts": ["test"],
                **kwargs,
            }
        )

    def use_cassette(self, **kwargs: Any) -> Cassette:
        file_name_parts = []
        if (test_cls := self._request.node.cls) is not None:
            file_name_parts.append(test_cls.__name__)
        module_name = self._request.node.module.__name__.split(".")[-1]
        test_name = self._request.node.name
        file_name_parts.append(_remove_parameters(test_name))
        test_file_path = self._request.path
        path = (
            test_file_path.parent / "cassettes" / module_name / f"{'.'.join(file_name_parts)}.yaml"
        )
        return super().use_cassette(**{"path": path, **kwargs})


def remove_request_headers(request: Any) -> Any:
    """
    Removes all request headers.

    Example:
    ```
    @pytest.mark.vcr(
        before_record_response=remove_all_vcr_request_headers
    )
    def test_openai() -> None:
        # make request to OpenAI
    """
    request.headers.clear()
    return request


def remove_response_headers(response: dict[str, Any]) -> dict[str, Any]:
    """
    Removes all response headers.

    Example:
    ```
    @pytest.mark.vcr(
        before_record_response=remove_all_vcr_response_headers
    )
    def test_openai() -> None:
        # make request to OpenAI
    """
    response["headers"] = {}
    return response


def _remove_parameters(test_name: str) -> str:
    """
    Removes the parameters name from the test name if it exists.

    Example:

    test_name: test_example[param]

    Returns:

    test_example
    """
    return re.sub(r"\[[^\[]*\]$", "", test_name)
