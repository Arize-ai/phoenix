from typing import Optional

import pytest

from phoenix.server.grpc_server import _bind_address

_PORT = 4317


@pytest.mark.parametrize(
    "host, expected",
    [
        pytest.param("127.0.0.1", f"127.0.0.1:{_PORT}", id="ipv4_loopback"),
        pytest.param("::1", f"[::1]:{_PORT}", id="ipv6_loopback"),
        pytest.param("localhost", f"localhost:{_PORT}", id="localhost"),
        pytest.param("0.0.0.0", f"0.0.0.0:{_PORT}", id="all_ipv4"),
        pytest.param(None, f"[::]:{_PORT}", id="all_interfaces"),
    ],
)
def test_bind_address(host: Optional[str], expected: str) -> None:
    assert _bind_address(host, _PORT) == expected
