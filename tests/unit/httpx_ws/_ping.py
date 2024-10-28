import secrets
import threading
import typing

import anyio


class PingManagerBase:
    def _generate_id(self) -> bytes:
        return secrets.token_bytes()


class PingManager(PingManagerBase):
    def __init__(self) -> None:
        self._pings: dict[bytes, threading.Event] = {}

    def create(self, ping_id: typing.Optional[bytes] = None) -> tuple[bytes, threading.Event]:
        ping_id = self._generate_id() if not ping_id else ping_id
        event = threading.Event()
        self._pings[ping_id] = event
        return ping_id, event

    def ack(self, ping_id: typing.Union[bytes, bytearray]):
        event = self._pings.pop(bytes(ping_id))
        event.set()


class AsyncPingManager(PingManagerBase):
    def __init__(self) -> None:
        self._pings: dict[bytes, anyio.Event] = {}

    def create(self, ping_id: typing.Optional[bytes] = None) -> tuple[bytes, anyio.Event]:
        ping_id = self._generate_id() if not ping_id else ping_id
        event = anyio.Event()
        self._pings[ping_id] = event
        return ping_id, event

    def ack(self, ping_id: typing.Union[bytes, bytearray]):
        event = self._pings.pop(bytes(ping_id))
        event.set()
