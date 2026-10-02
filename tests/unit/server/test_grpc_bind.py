from typing import Optional

import grpc
import pytest

from phoenix.config import get_env_host
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
        pytest.param("127.1", f"127.1:{_PORT}", id="unparsed_spelling"),
    ],
)
def test_bind_address(host: Optional[str], expected: str) -> None:
    assert _bind_address(host, _PORT) == expected


async def test_canonical_loopback_grpc_bind(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_HOST", "127.1")
    host = get_env_host()
    assert host == "127.0.0.1"
    server = grpc.aio.server()
    bound = server.add_insecure_port(_bind_address(host, 0))
    await server.start()
    try:
        assert bound > 0
    finally:
        await server.stop(0)
