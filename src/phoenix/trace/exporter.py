import gzip
import logging
import weakref
from queue import SimpleQueue
from threading import Thread
from types import MethodType
from typing import Any, Optional

import requests
from requests import Session

import phoenix.trace.v1 as pb
from phoenix.config import get_env_collector_url, get_env_host, get_env_port
from phoenix.trace.schemas import Span
from phoenix.trace.v1.utils import encode

logger = logging.getLogger(__name__)
# logger.addHandler(logging.NullHandler())

END_OF_QUEUE = None  # sentinel value for queue termination


# These two lines enable debugging at httplib level (requests->urllib3->http.client)
# You will see the REQUEST, including HEADERS and DATA, and RESPONSE with HEADERS but without DATA.
# The only thing missing will be the response.body which is not logged.
try:
    import http.client as http_client
except ImportError:
    # Python 2
    import httplib as http_client
http_client.HTTPConnection.debuglevel = 1

# You must initialize logging, otherwise you'll not see debug output.
logging.basicConfig()
logging.getLogger().setLevel(logging.DEBUG)
requests_log = logging.getLogger("requests.packages.urllib3")
requests_log.setLevel(logging.DEBUG)
requests_log.propagate = True


class NoOpExporter:
    def export(self, _: Any) -> None:
        pass


class HttpExporter:
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        collector_url: Optional[str] = None,
    ) -> None:
        """
        Span Exporter using HTTP.

        Parameters
        ----------
        host: Optional[str]
            The host of the Phoenix server. It can also be set using environment
            variable `PHOENIX_HOST`, otherwise it defaults to `127.0.0.1`.
        port: Optional[int]
            The port of the Phoenix server. It can also be set using environment
            variable `PHOENIX_PORT`, otherwise it defaults to `6006`.
        collector_url: Optional[str]
            The URL of the span / evals collector. If this is set, the host and
            port parameters are ignored. This must be used when the collector is
            not running in the same process as the tracer.
            (e.x. running on a separate instance)
        """
        self._host = host or get_env_host()
        self._port = port or get_env_port()
        url = collector_url or get_env_collector_url() or f"http://{self._host}:{self._port}"
        # Strip off any trailing slashes
        self._base_url = url.rstrip("/")
        self._warn_if_phoenix_is_not_running()
        self._session = Session()
        weakref.finalize(self, self._session.close)
        self._session.headers.update(
            {
                "content-type": "application/x-protobuf",
                "content-encoding": "gzip",
            }
        )
        self._queue: "SimpleQueue[Optional[pb.Span]]" = SimpleQueue()
        # Putting `None` as the sentinel value for queue termination.
        weakref.finalize(self, self._queue.put, END_OF_QUEUE)
        self._start_consumer()

    def export(self, span: Span) -> None:
        self._queue.put(encode(span))

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

    def _send(self, item: pb.Span) -> None:
        serialized = item.SerializeToString()
        data = gzip.compress(serialized)
        try:
            print(
                "Sending data to Phoenix...",
                self._url(item),
            )
            self._session.post(self._url(item), data=data)
        except Exception as e:
            print("Failed to send data to Phoenix" + str(e))
            logger.exception(e)

    def _url(self, _: pb.Span) -> str:
        return f"{self._base_url}/v1/spans"

    def _warn_if_phoenix_is_not_running(self) -> None:
        try:
            requests.get(f"{self._base_url}/arize_phoenix_version").raise_for_status()
        except Exception:
            logger.warning(
                f"Arize Phoenix is not running on {self._base_url}. Launch Phoenix "
                f"with `import phoenix as px; px.launch_app()`"
            )
