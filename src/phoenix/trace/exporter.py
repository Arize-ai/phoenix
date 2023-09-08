import gzip
import logging
import weakref
from queue import SimpleQueue
from threading import Thread
from typing import Optional

from requests import Session

from phoenix.config import PORT
from phoenix.trace.schemas import Span
from phoenix.trace.v1 import encode

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


class NoOpExporter:
    def export(self, span: Span) -> None:
        pass


class HttpExporter:
    def __init__(self, port: int = PORT) -> None:
        self._url = f"http://localhost:{port}/v1/spans"
        self._session = Session()
        weakref.finalize(self, self._session.close)
        self._session.headers.update(
            {
                "content-type": "application/x-protobuf",
                "content-encoding": "gzip",
            }
        )
        self._queue: "SimpleQueue[Optional[Span]]" = SimpleQueue()
        # Putting `None` as the sentinel value for queue termination.
        weakref.finalize(self, self._queue.put, None)
        self._start_consumer()

    def export(self, span: Span) -> None:
        self._queue.put(span)

    def _start_consumer(self) -> None:
        Thread(target=self._consume_spans, daemon=True).start()

    def _consume_spans(self) -> None:
        while True:
            if not (span := self._queue.get()):
                return
            self._send(span)

    def _send(self, span: Span) -> None:
        pb_span = encode(span)
        serialized = pb_span.SerializeToString()
        data = gzip.compress(serialized)
        try:
            self._session.post(self._url, data=data)
        except Exception as e:
            logger.exception(e)
