import csv
import gzip
import logging
import weakref
from collections import Counter
from datetime import datetime
from io import BytesIO, StringIO
from pathlib import Path
from typing import (
    Any,
    BinaryIO,
    Dict,
    Iterable,
    List,
    Literal,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
    cast,
)
from urllib.parse import quote, urljoin

import httpx
import pandas as pd
import pyarrow as pa
from httpx import HTTPStatusError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, KeyValue
from opentelemetry.proto.resource.v1.resource_pb2 import Resource
from opentelemetry.proto.trace.v1.trace_pb2 import ResourceSpans, ScopeSpans
from pyarrow import ArrowInvalid, Table
from typing_extensions import TypeAlias, assert_never

from phoenix.config import (
    get_env_client_headers,
    get_env_collector_endpoint,
    get_env_host,
    get_env_port,
    get_env_project_name,
)
from phoenix.datasets.types import Dataset, Example
from phoenix.datetime_utils import normalize_datetime
from phoenix.db.insertion.dataset import DatasetKeys
from phoenix.session.data_extractor import DEFAULT_SPAN_LIMIT, TraceDataExtractor
from phoenix.trace import Evaluations, TraceDataset
from phoenix.trace.dsl import SpanQuery
from phoenix.trace.otel import encode_span_to_otlp

logger = logging.getLogger(__name__)

DatasetAction: TypeAlias = Literal["create", "append"]


class Client(TraceDataExtractor):
    def __init__(
        self,
        *,
        endpoint: Optional[str] = None,
        warn_if_server_not_running: bool = True,
        headers: Optional[Mapping[str, str]] = None,
        **kwargs: Any,  # for backward-compatibility
    ):
        """
        Client for connecting to a Phoenix server.

        Args:
            endpoint (str, optional): Phoenix server endpoint, e.g.
            http://localhost:6006. If not provided, the endpoint will be
            inferred from the environment variables.

            headers (Mapping[str, str], optional): Headers to include in each
            network request. If not provided, the headers will be inferred from
            the environment variables (if present).
        """
        if kwargs.pop("use_active_session_if_available", None) is not None:
            print(
                "`use_active_session_if_available` is deprecated "
                "and will be removed in the future."
            )
        if kwargs:
            raise TypeError(f"Unexpected keyword arguments: {', '.join(kwargs)}")
        headers = headers or get_env_client_headers()
        host = get_env_host()
        if host == "0.0.0.0":
            host = "127.0.0.1"
        base_url = endpoint or get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
        self._base_url = base_url if base_url.endswith("/") else base_url + "/"
        self._client = httpx.Client(headers=headers)
        weakref.finalize(self, self._client.close)
        if warn_if_server_not_running:
            self._warn_if_phoenix_is_not_running()

    @property
    def web_url(self) -> str:
        """
        Return the web URL of the Phoenix UI. This is different from the base
        URL in the cases where there is a proxy like colab


        Returns:
            str: A fully qualified URL to the Phoenix UI.
        """
        # Avoid circular import
        from phoenix.session.session import active_session

        if session := active_session():
            return session.url
        return self._base_url

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
        response = self._client.post(
            url=urljoin(self._base_url, "v1/spans"),
            params={"project-name": project_name},
            json={
                "queries": [q.to_dict() for q in queries],
                "start_time": _to_iso_format(normalize_datetime(start_time)),
                "end_time": _to_iso_format(normalize_datetime(end_time)),
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
        response = self._client.get(
            url=urljoin(self._base_url, "v1/evaluations"),
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
            self._client.get(urljoin(self._base_url, "arize_phoenix_version")).raise_for_status()
        except Exception:
            logger.warning(
                f"Arize Phoenix is not running on {self._base_url}. Launch Phoenix "
                f"with `import phoenix as px; px.launch_app()`"
            )

    def log_evaluations(self, *evals: Evaluations, **kwargs: Any) -> None:
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
        if kwargs.pop("project_name", None) is not None:
            print("Keyword argument `project_name` is no longer necessary and is ignored.")
        if kwargs:
            raise TypeError(f"Unexpected keyword arguments: {', '.join(kwargs)}")
        for evaluation in evals:
            table = evaluation.to_pyarrow_table()
            sink = pa.BufferOutputStream()
            headers = {"content-type": "application/x-pandas-arrow"}
            with pa.ipc.new_stream(sink, table.schema) as writer:
                writer.write_table(table)
            self._client.post(
                url=urljoin(self._base_url, "v1/evaluations"),
                content=cast(bytes, sink.getvalue().to_pybytes()),
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
            content = gzip.compress(serialized)
            self._client.post(
                url=urljoin(self._base_url, "v1/traces"),
                content=content,
                headers={
                    "content-type": "application/x-protobuf",
                    "content-encoding": "gzip",
                },
            ).raise_for_status()

    def _get_dataset_id_by_name(self, name: str) -> str:
        """
         Gets a dataset by name.

         Args:
             name (str): The name of the dataset.
             version_id (Optional[str]): The version ID of the dataset. Default None.

        Returns:
             Dataset: The dataset object.
        """
        response = self._client.get(
            urljoin(self._base_url, "/v1/datasets"),
            params={"name": name},
        )
        response.raise_for_status()
        if not (records := response.json()["data"]):
            raise ValueError(f"Failed to query dataset by name: {name}")
        if len(records) > 1 or not records[0]:
            raise ValueError(f"Failed to find a single dataset with the given name: {name}")
        dataset = records[0]
        return str(dataset["id"])

    def get_dataset(
        self,
        *,
        id: Optional[str] = None,
        name: Optional[str] = None,
        version_id: Optional[str] = None,
    ) -> Dataset:
        """
        Gets the dataset for a specific version, or gets the latest version of
        the dataset if no version is specified.

        Args:

            id (Optional[str]): An ID for the dataset.

            name (Optional[str]): the name for the dataset. If provided, the ID
            is ignored and the dataset is retrieved by name.

            version_id (Optional[str]): An ID for the version of the dataset, or
            None.

        Returns:
            A dataset object.
        """
        if name:
            id = self._get_dataset_id_by_name(name)

        if not id:
            raise ValueError("Dataset id or name must be provided.")

        response = self._client.get(
            urljoin(self._base_url, f"/v1/datasets/{quote(id)}/examples"),
            params={"version-id": version_id} if version_id else None,
        )
        response.raise_for_status()
        data = response.json()["data"]
        examples = [
            Example(
                id=example["id"],
                input=example["input"],
                output=example["output"],
                metadata=example["metadata"],
                updated_at=datetime.fromisoformat(example["updated_at"]),
            )
            for example in data["examples"]
        ]
        resolved_dataset_id = data["dataset_id"]
        resolved_version_id = data["version_id"]
        return Dataset(
            id=resolved_dataset_id,
            version_id=resolved_version_id,
            examples=examples,
        )

    def get_dataset_versions(
        self,
        dataset_id: str,
        /,
        *,
        limit: Optional[int] = 100,
    ) -> pd.DataFrame:
        """
        Get dataset versions as pandas DataFrame.

        Args:
            dataset_id (str): dataset ID
            limit (Optional[int]): maximum number of versions to return,
                starting from the most recent version

        Returns:
            pandas DataFrame
        """
        url = urljoin(self._base_url, f"v1/datasets/{dataset_id}/versions")
        response = httpx.get(url=url, params={"limit": limit})
        response.raise_for_status()
        if not (records := response.json()["data"]):
            return pd.DataFrame()
        df = pd.DataFrame.from_records(records, index="version_id")
        df["created_at"] = pd.to_datetime(df.created_at)
        return df

    def download_dataset_examples(
        self,
        dataset_id: str,
        /,
        *,
        dataset_version_id: Optional[str] = None,
    ) -> pd.DataFrame:
        """
        Download dataset examples as pandas DataFrame.

        Args:
            dataset_id (str): dataset ID
            dataset_version_id (Optional[str]): dataset version ID, if omitted,
               the latest version is returned.

        Returns:
            pandas DataFrame
        """
        url = f"v1/datasets/{dataset_id}/csv"
        response = httpx.get(
            url=urljoin(self._base_url, url),
            params={"version": dataset_version_id} if dataset_version_id else {},
        )
        response.raise_for_status()
        return pd.read_csv(
            StringIO(response.content.decode()),
            index_col="example_id",
        )

    def create_examples(
        self,
        *,
        dataset_name: str,
        inputs: Iterable[Mapping[str, Any]],
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        dataset_description: Optional[str] = None,
    ) -> Dataset:
        """
        Upload examples as dataset to the Phoenix server.

        Args:
            dataset_name: (str): Name of the dataset
            inputs (Iterable[Mapping[str, Any]]): List of dictionaries object each
                corresponding to an example in the dataset.
            outputs (Iterable[Mapping[str, Any]]): List of dictionaries object each
                corresponding to an example in the dataset.
            metadata (Iterable[Mapping[str, Any]]): List of dictionaries object each
                corresponding to an example in the dataset.
            dataset_description: (Optional[str]): Description of the dataset.

        Returns:
            A Dataset object with the uploaded examples.
        """
        # convert to list to avoid issues with pandas Series
        inputs, outputs, metadata = list(inputs), list(outputs), list(metadata)
        if not inputs or not _is_all_dict(inputs):
            raise ValueError(
                "`inputs` should be a non-empty sequence containing only dictionary objects"
            )
        for name, seq in {"outputs": outputs, "metadata": metadata}.items():
            if seq and not (len(seq) == len(inputs) and _is_all_dict(seq)):
                raise ValueError(
                    f"`{name}` should be a sequence of the same length as `inputs` "
                    "containing only dictionary objects"
                )
        action: DatasetAction = "create"
        print("📤 Uploading dataset...")
        response = self._client.post(
            url=urljoin(self._base_url, "v1/datasets/upload"),
            headers={"Content-Encoding": "gzip"},
            json={
                "action": action,
                "name": dataset_name,
                "description": dataset_description,
                "inputs": inputs,
                "outputs": outputs,
                "metadata": metadata,
            },
            params={"sync": True},
        )
        try:
            response.raise_for_status()
        except HTTPStatusError as e:
            if msg := response.text:
                raise DatasetUploadError(msg) from e
            raise
        data = response.json()["data"]
        dataset_id = data["dataset_id"]
        response = self._client.get(
            url=urljoin(self._base_url, f"v1/datasets/{dataset_id}/examples")
        )
        response.raise_for_status()
        data = response.json()["data"]
        version_id = data["version_id"]
        examples = data["examples"]
        print(f"💾 Examples uploaded: {self.web_url}datasets/{dataset_id}/examples")
        print(f"🗄️ Dataset version ID: {version_id}")

        return Dataset(
            id=dataset_id,
            version_id=version_id,
            examples=[
                Example(
                    id=example["id"],
                    input=example["input"],
                    output=example["output"],
                    metadata=example["metadata"],
                    updated_at=datetime.fromisoformat(example["updated_at"]),
                )
                for example in examples
            ],
        )

    def upload_dataset(
        self,
        table: Union[str, Path, pd.DataFrame],
        /,
        *,
        name: str,
        input_keys: Iterable[str],
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        description: Optional[str] = None,
        action: Literal["create", "append"] = "create",
    ) -> Dataset:
        """
        Upload examples as dataset to the Phoenix server.

        Args:
            table (str | Path | pd.DataFrame): Location of a CSV text file, or
                pandas DataFrame.
            name: (str): Name of the dataset. Required if action=append.
            input_keys (Iterable[str]): List of column names used as input keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            output_keys (Iterable[str]): List of column names used as output keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            metadata_keys (Iterable[str]): List of column names used as metadata keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            description: (Optional[str]): Description of the dataset.
            action: (Literal["create", "append"): Create new dataset or append to an
                existing dataset. If action=append, dataset name is required.

        Returns:
            A Dataset object with the uploaded examples.
        """
        if action not in ("create", "append"):
            raise ValueError(f"Invalid action: {action}")
        if not name:
            raise ValueError("Dataset name must not be blank")
        keys = DatasetKeys(
            frozenset(input_keys),
            frozenset(output_keys),
            frozenset(metadata_keys),
        )
        if isinstance(table, pd.DataFrame):
            file = _prepare_pyarrow(table, keys)
        elif isinstance(table, (str, Path)):
            file = _prepare_csv(Path(table), keys)
        else:
            assert_never(table)
        print("📤 Uploading dataset...")
        response = self._client.post(
            url=urljoin(self._base_url, "v1/datasets/upload"),
            files={"file": file},
            data={
                "action": action,
                "name": name,
                "description": description,
                "input_keys[]": sorted(keys.input),
                "output_keys[]": sorted(keys.output),
                "metadata_keys[]": sorted(keys.metadata),
            },
            params={"sync": True},
        )
        try:
            response.raise_for_status()
        except HTTPStatusError as e:
            if msg := response.text:
                raise DatasetUploadError(msg) from e
            raise
        data = response.json()["data"]
        dataset_id = data["dataset_id"]
        response = self._client.get(
            url=urljoin(self._base_url, f"v1/datasets/{dataset_id}/examples")
        )
        response.raise_for_status()
        data = response.json()["data"]
        version_id = data["version_id"]
        examples = data["examples"]
        print(f"💾 Examples uploaded: {self.web_url}datasets/{dataset_id}/examples")
        print(f"🗄️ Dataset version ID: {version_id}")

        return Dataset(
            id=dataset_id,
            version_id=version_id,
            examples=[
                Example(
                    id=example["id"],
                    input=example["input"],
                    output=example["output"],
                    metadata=example["metadata"],
                    updated_at=datetime.fromisoformat(example["updated_at"]),
                )
                for example in examples
            ],
        )


FileName: TypeAlias = str
FilePointer: TypeAlias = BinaryIO
FileType: TypeAlias = str
FileHeaders: TypeAlias = Dict[str, str]


def _prepare_csv(
    path: Path,
    keys: DatasetKeys,
) -> Tuple[FileName, FilePointer, FileType, FileHeaders]:
    path = path.resolve()
    if not path.is_file():
        raise FileNotFoundError(f"File does not exist: {path}")
    with open(path, "r") as f:
        rows = csv.reader(f)
        try:
            column_headers = next(rows)
            _ = next(rows)
        except StopIteration:
            raise ValueError("csv file has no data")
    (header, freq), *_ = Counter(column_headers).most_common(1)
    if freq > 1:
        raise ValueError(f"Duplicated column header in CSV file: {header}")
    keys.check_differences(frozenset(column_headers))
    file = BytesIO()
    with open(path, "rb") as f:
        file.write(gzip.compress(f.read()))
    return path.name, file, "text/csv", {"Content-Encoding": "gzip"}


def _prepare_pyarrow(
    df: pd.DataFrame,
    keys: DatasetKeys,
) -> Tuple[FileName, FilePointer, FileType, FileHeaders]:
    if df.empty:
        raise ValueError("dataframe has no data")
    (header, freq), *_ = Counter(df.columns).most_common(1)
    if freq > 1:
        raise ValueError(f"Duplicated column header in file: {header}")
    keys.check_differences(frozenset(df.columns))
    table = Table.from_pandas(df.loc[:, list(keys)])
    sink = pa.BufferOutputStream()
    options = pa.ipc.IpcWriteOptions(compression="lz4")
    with pa.ipc.new_stream(sink, table.schema, options=options) as writer:
        writer.write_table(table)
    file = BytesIO(sink.getvalue().to_pybytes())
    return "pandas", file, "application/x-pandas-pyarrow", {}


def _to_iso_format(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _is_all_dict(seq: Sequence[Any]) -> bool:
    return all(map(lambda obj: isinstance(obj, dict), seq))


class DatasetUploadError(Exception): ...
