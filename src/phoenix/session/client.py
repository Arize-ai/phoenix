import logging
import weakref
from datetime import datetime
from io import BytesIO
from typing import List, Optional, Union, cast

import pandas as pd
import pyarrow as pa
from pyarrow import ArrowInvalid
from requests import Session
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY

import phoenix as px
from phoenix.config import get_env_host, get_env_port
from phoenix.trace.dsl import SpanQuery

logger = logging.getLogger(__name__)


class Client:
    def __init__(
        self,
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
            If active session is available, use it instead of creating sending HTTP requests.
        """
        self._use_active_session_if_available = use_active_session_if_available
        self._base_url = endpoint or f"http://{get_env_host()}:{get_env_port()}"
        self._session = Session()
        weakref.finalize(self, self._session.close)
        if not (self._use_active_session_if_available and px.active_session()):
            self._warn_if_phoenix_is_not_running()

    def get_spans_dataframe(
        self,
        filter_condition: Optional[str] = None,
        *,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
        root_spans_only: Optional[bool] = None,
    ) -> Optional[pd.DataFrame]:
        if self._use_active_session_if_available and (session := px.active_session()):
            return session.get_spans_dataframe(
                filter_condition,
                start_time=start_time,
                stop_time=stop_time,
                root_spans_only=root_spans_only,
            )
        response = self._session.post(
            url=f"{self._base_url}/v1/get_spans_dataframe",
            json={
                "filter_condition": filter_condition,
                "start_time": start_time,
                "stop_time": stop_time,
                "root_spans_only": root_spans_only,
            },
        )
        if response.status_code == HTTP_404_NOT_FOUND:
            logger.info("No spans found.")
            return None
        elif response.status_code == HTTP_422_UNPROCESSABLE_ENTITY:
            logger.error(response.content.decode())
        response.raise_for_status()
        stream = BytesIO(response.content)
        with pa.ipc.open_stream(stream) as pa_stream:
            return cast(pd.DataFrame, pa_stream.read_all().to_pandas())

    def query_spans(
        self,
        *queries: SpanQuery,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
    ) -> Optional[Union[pd.DataFrame, List[pd.DataFrame]]]:
        if not queries:
            return None
        if self._use_active_session_if_available and (session := px.active_session()):
            return session.query_spans(
                *queries,
                start_time=start_time,
                stop_time=stop_time,
            )
        response = self._session.post(
            url=f"{self._base_url}/v1/query_spans",
            json={
                "queries": [q.to_dict() for q in queries],
                "start_time": start_time,
                "stop_time": stop_time,
            },
        )
        if response.status_code == HTTP_404_NOT_FOUND:
            logger.info("No spans found.")
            return None
        elif response.status_code == HTTP_422_UNPROCESSABLE_ENTITY:
            logger.error(response.content.decode())
        response.raise_for_status()
        stream = BytesIO(response.content)
        results = []
        while True:
            try:
                with pa.ipc.open_stream(stream) as pa_stream:
                    results.append(pa_stream.read_all().to_pandas())
            except ArrowInvalid:
                break
        return results[0] if len(results) == 1 else results

    def _warn_if_phoenix_is_not_running(self) -> None:
        try:
            self._session.get(f"{self._base_url}/arize_phoenix_version").raise_for_status()
        except Exception:
            logger.warning(
                f"Arize Phoenix is not running on {self._base_url}. Launch Phoenix "
                f"with `import phoenix as px; px.launch_app()`"
            )
