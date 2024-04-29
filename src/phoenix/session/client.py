import gzip
import logging
import weakref
from datetime import datetime
from io import BytesIO
from typing import Any, List, Optional, Union, cast
from urllib.parse import urljoin

import pandas as pd
import pyarrow as pa
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, KeyValue
from opentelemetry.proto.resource.v1.resource_pb2 import Resource
from opentelemetry.proto.trace.v1.trace_pb2 import ResourceSpans, ScopeSpans
from pyarrow import ArrowInvalid
from requests import Session

from phoenix.config import (
    get_env_collector_endpoint,
    get_env_host,
    get_env_port,
    get_env_project_name,
)
from phoenix.session.data_extractor import DEFAULT_SPAN_LIMIT, TraceDataExtractor
from phoenix.trace import Evaluations, TraceDataset
from phoenix.trace.dsl import SpanQuery
from phoenix.trace.otel import encode_span_to_otlp

logger = logging.getLogger(__name__)


class Client(TraceDataExtractor):
    def __init__(
        self,
        *,
        endpoint: Optional[str] = None,
        warn_if_server_not_running: bool = True,
        **kwargs: Any,  # for backward-compatibility
    ):
        """
        Client for connecting to a Phoenix server.

        Args:
            endpoint (str, optional): Phoenix server endpoint, e.g. http://localhost:6006. If not
                provided, the endpoint will be inferred from the environment variables.
        """
        if "use_active_session_if_available" in kwargs:
            print(
                "`use_active_session_if_available` is deprecated "
                "and will be removed in the future."
            )
        host = get_env_host()
        if host == "0.0.0.0":
            host = "127.0.0.1"
        self._base_url = (
            endpoint or get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
        )
        self._session = Session()
        weakref.finalize(self, self._session.close)
        if warn_if_server_not_running:
            self._warn_if_phoenix_is_not_running()

    def query_spans(
        self,
        *queries: SpanQuery,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = DEFAULT_SPAN_LIMIT,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
        # Deprecated
        stop_time: Optional[datetime] = None,
    ) -> Optional[Union[pd.DataFrame, List[pd.DataFrame]]]:
        """
        Queries spans from the Phoenix server or active session based on specified criteria.

        Args:
            queries (SpanQuery): One or more SpanQuery objects defining the query criteria.
            start_time (datetime, optional): The start time for the query range. Default None.
            end_time (datetime, optional): The end time for the query range. Default None.
            root_spans_only (bool, optional): If True, only root spans are returned. Default None.
            project_name (str, optional): The project name to query spans for. This can be set
                using environment variables. If not provided, falls back to the default project.

        Returns:
            Union[pd.DataFrame, List[pd.DataFrame]]: A pandas DataFrame or a list of pandas
                DataFrames containing the queried span data, or None if no spans are found.
        """
        project_name = project_name or get_env_project_name()
        if not queries:
            queries = (SpanQuery(),)
        if stop_time is not None:
            # Deprecated. Raise a warning
            logger.warning(
                "stop_time is deprecated. Use end_time instead.",
            )
            end_time = end_time or stop_time
        response = self._session.post(
            url=urljoin(self._base_url, "/v1/spans"),
            params={"project-name": project_name},
            json={
                "queries": [q.to_dict() for q in queries],
                "start_time": _to_iso_format(start_time),
                "end_time": _to_iso_format(end_time),
                "limit": limit,
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

    def get_evaluations(
        self,
        project_name: Optional[str] = None,
    ) -> List[Evaluations]:
        """
        Retrieves evaluations for a given project from the Phoenix server or active session.

        Args:
            project_name (str, optional): The name of the project to retrieve evaluations for.
                This can be set using environment variables. If not provided, falls back to the
                default project.

        Returns:
            List[Evaluations]: A list of Evaluations objects containing evaluation data. Returns an
                empty list if no evaluations are found.
        """
        project_name = project_name or get_env_project_name()
        response = self._session.get(
            urljoin(self._base_url, "/v1/evaluations"),
            params={"project-name": project_name},
        )
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
                    results.append(Evaluations.from_pyarrow_reader(reader))
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

    def log_evaluations(self, *evals: Evaluations, project_name: Optional[str] = None) -> None:
        """
        Logs evaluation data to the Phoenix server.

        Args:
            evals (Evaluations): One or more Evaluations objects containing the data to log.
            project_name (str, optional): The project name under which to log the evaluations.
                This can be set using environment variables. If not provided, falls back to the
                default project.

        Returns:
            None
        """
        project_name = project_name or get_env_project_name()
        for evaluation in evals:
            table = evaluation.to_pyarrow_table()
            sink = pa.BufferOutputStream()
            headers = {"content-type": "application/x-pandas-arrow"}
            params = {"project-name": project_name}
            with pa.ipc.new_stream(sink, table.schema) as writer:
                writer.write_table(table)
            self._session.post(
                urljoin(self._base_url, "/v1/evaluations"),
                data=cast(bytes, sink.getvalue().to_pybytes()),
                params=params,
                headers=headers,
            ).raise_for_status()

    def log_traces(self, trace_dataset: TraceDataset, project_name: Optional[str] = None) -> None:
        """
        Logs traces from a TraceDataset to the Phoenix server.

        Args:
            trace_dataset (TraceDataset): A TraceDataset instance with the traces to log to
                the Phoenix server.
            project_name (str, optional): The project name under which to log the evaluations.
                This can be set using environment variables. If not provided, falls back to the
                default project.

        Returns:
            None
        """
        project_name = project_name or get_env_project_name()
        spans = trace_dataset.to_spans()
        otlp_spans = [
            ExportTraceServiceRequest(
                resource_spans=[
                    ResourceSpans(
                        resource=Resource(
                            attributes=[
                                KeyValue(
                                    key="openinference.project.name",
                                    value=AnyValue(string_value=project_name),
                                )
                            ]
                        ),
                        scope_spans=[ScopeSpans(spans=[encode_span_to_otlp(span)])],
                    )
                ],
            )
            for span in spans
        ]
        for otlp_span in otlp_spans:
            serialized = otlp_span.SerializeToString()
            data = gzip.compress(serialized)
            self._session.post(
                urljoin(self._base_url, "/v1/traces"),
                data=data,
                headers={
                    "content-type": "application/x-protobuf",
                    "content-encoding": "gzip",
                },
            ).raise_for_status()


def _to_iso_format(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None
