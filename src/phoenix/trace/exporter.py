import gzip
import logging
import weakref
from queue import SimpleQueue
from threading import Thread
from types import MethodType
from typing import Any, Optional, Union

import requests
from requests import Session
from typing_extensions import TypeAlias

import phoenix.trace.v1 as pb
from phoenix.config import get_env_host, get_env_port
from phoenix.trace.schemas import Span
from phoenix.trace.v1.utils import encode

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

END_OF_QUEUE = None  # sentinel value for queue termination

Message: TypeAlias = Union[pb.Span, pb.Evaluation]


class NoOpExporter:
    def export(self, _: Any) -> None:
        pass


class HttpExporter:
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
    ) -> None:
        """
        Span/Evaluation Exporter using HTTP.

        Parameters
        ----------
        host: Optional[str]
            The host of the Phoenix server. It can also be set using environment
            variable `PHOENIX_HOST`, otherwise it defaults to `127.0.0.1`.
        port: Optional[int]
            The port of the Phoenix server. It can also be set using environment
            variable `PHOENIX_PORT`, otherwise it defaults to `6006`.
        """
        self._host = host or get_env_host()
        self._port = port or get_env_port()
        self._base_url = f"http://{self._host}:{self._port}"
        self._warn_if_phoenix_is_not_running()
        self._session = Session()
        weakref.finalize(self, self._session.close)
        self._session.headers.update(
            {
                "content-type": "application/x-protobuf",
                "content-encoding": "gzip",
            }
        )
        self._queue: "SimpleQueue[Optional[Message]]" = SimpleQueue()
        # Putting `None` as the sentinel value for queue termination.
        weakref.finalize(self, self._queue.put, END_OF_QUEUE)
        self._start_consumer()

    def export(self, item: Union[Span, pb.Evaluation]) -> None:
        if isinstance(item, Span):
            self._queue.put(encode(item))
        elif isinstance(item, pb.Evaluation):
            self._queue.put(item)

    def _start_consumer(self) -> None:
        Thread(
            target=MethodType(
                self.__class__._consume_items,
                weakref.proxy(self),
            ),
            daemon=True,
        ).start()

    def _consume_items(self) -> None:
        while (item := self._queue.get()) is not END_OF_QUEUE:
            self._send(item)

    def _send(self, message: Message) -> None:
        serialized = message.SerializeToString()
        data = gzip.compress(serialized)
        try:
            self._session.post(self._url(message), data=data).raise_for_status()
        except Exception as e:
            logger.exception(e)

    def _url(self, message: Message) -> str:
        if isinstance(message, pb.Span):
            return f"{self._base_url}/v1/spans"
        if isinstance(message, pb.Evaluation):
            return f"{self._base_url}/v1/evaluations"
        raise ValueError(f"Unknown message type: {type(message)}")

    def _warn_if_phoenix_is_not_running(self) -> None:
        try:
            requests.get(f"{self._base_url}/arize_phoenix_version").raise_for_status()
        except Exception:
            logger.warning(
                f"Arize Phoenix is not running on {self._base_url}. Launch Phoenix "
                f"with `import phoenix as px; px.launch_app()`"
            )
