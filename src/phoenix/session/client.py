import logging
import weakref
from datetime import datetime
from io import BytesIO
from typing import List, Optional, Union
from urllib.parse import urljoin

import pandas as pd
import pyarrow as pa
from pyarrow import ArrowInvalid
from requests import Session

import phoenix as px
from phoenix.config import get_env_collector_endpoint, get_env_host, get_env_port
from phoenix.session.data_extractor import TraceDataExtractor
from phoenix.trace import Evaluations
from phoenix.trace.dsl import SpanQuery

logger = logging.getLogger(__name__)


class Client(TraceDataExtractor):
    def __init__(
        self,
        *,
        endpoint: Optional[str] = None,
        use_active_session_if_available: bool = True,
    ):
        """
        Client for connecting to a Phoenix server.

        Parameters
        ----------
        endpoint : str, optional
            Phoenix server endpoint, e.g. http://localhost:6006. If not provided, the
            endpoint will be inferred from the environment variables.
        use_active_session_if_available : bool, optional
            If active session is available, use it instead of sending HTTP requests.
        """
        self._use_active_session_if_available = use_active_session_if_available
        host = get_env_host()
        if host == "0.0.0.0":
            host = "127.0.0.1"
        self._base_url = (
            endpoint or get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
        )
        self._session = Session()
        weakref.finalize(self, self._session.close)
        if not (self._use_active_session_if_available and px.active_session()):
            self._warn_if_phoenix_is_not_running()

    def query_spans(
        self,
        *queries: SpanQuery,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
        root_spans_only: Optional[bool] = None,
    ) -> Optional[Union[pd.DataFrame, List[pd.DataFrame]]]:
        if not queries:
            queries = (SpanQuery(),)
        if self._use_active_session_if_available and (session := px.active_session()):
            return session.query_spans(
                *queries,
                start_time=start_time,
                stop_time=stop_time,
                root_spans_only=root_spans_only,
            )
        response = self._session.get(
            url=urljoin(self._base_url, "/v1/spans"),
            json={
                "queries": [q.to_dict() for q in queries],
                "start_time": _to_iso_format(start_time),
                "stop_time": _to_iso_format(stop_time),
                "root_spans_only": root_spans_only,
            },
        )
        if response.status_code == 404:
            logger.info("No spans found.")
            return None
        elif response.status_code == 422:
            raise ValueError(response.content.decode())
        response.raise_for_status()
        source = BytesIO(response.content)
        results = []
        while True:
            try:
                with pa.ipc.open_stream(source) as reader:
                    results.append(reader.read_pandas())
            except ArrowInvalid:
                break
        if len(results) == 1:
            df = results[0]
            return None if df.shape == (0, 0) else df
        return results

    def get_evaluations(self) -> List[Evaluations]:
        if self._use_active_session_if_available and (session := px.active_session()):
            return session.get_evaluations()
        response = self._session.get(urljoin(self._base_url, "/v1/evaluations"))
        if response.status_code == 404:
            logger.info("No evaluations found.")
            return []
        elif response.status_code == 422:
            raise ValueError(response.content.decode())
        response.raise_for_status()
        source = BytesIO(response.content)
        results = []
        while True:
            try:
                with pa.ipc.open_stream(source) as reader:
                    pa_table = reader.read_all()
                    results.append(Evaluations.from_pyarrow_table(pa_table))
            except ArrowInvalid:
                break
        return results

    def _warn_if_phoenix_is_not_running(self) -> None:
        try:
            self._session.get(urljoin(self._base_url, "/arize_phoenix_version")).raise_for_status()
        except Exception:
            logger.warning(
                f"Arize Phoenix is not running on {self._base_url}. Launch Phoenix "
                f"with `import phoenix as px; px.launch_app()`"
            )


def _to_iso_format(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None
