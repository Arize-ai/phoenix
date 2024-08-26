import csv
import gzip
import logging
import re
import weakref
from collections import Counter
from datetime import datetime
from io import BytesIO
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
from httpx import HTTPStatusError, Response
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
from phoenix.datetime_utils import normalize_datetime
from phoenix.db.insertion.dataset import DatasetKeys
from phoenix.experiments.types import Dataset, Example, Experiment
from phoenix.session.data_extractor import DEFAULT_SPAN_LIMIT, TraceDataExtractor
from phoenix.trace import Evaluations, TraceDataset
from phoenix.trace.dsl import SpanQuery
from phoenix.trace.otel import encode_span_to_otlp
from phoenix.utilities.client import VersionedClient

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

DEFAULT_TIMEOUT_IN_SECONDS = 5

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
        self._client = VersionedClient(headers=headers)
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
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
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
            Union[pd.DataFrame, List[pd.DataFrame]]:
                A pandas DataFrame or a list of pandas.
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
        try:
            response = self._client.post(
                url=urljoin(self._base_url, "v1/spans"),
                params={
                    "project_name": project_name,
                    "project-name": project_name,  # for backward-compatibility
                },
                json={
                    "queries": [q.to_dict() for q in queries],
                    "start_time": _to_iso_format(normalize_datetime(start_time)),
                    "end_time": _to_iso_format(normalize_datetime(end_time)),
                    "limit": limit,
                    "root_spans_only": root_spans_only,
                },
                timeout=timeout,
            )
        except httpx.TimeoutException as error:
            error_message = (
                (
                    f"The request timed out after {timeout} seconds. The timeout can be increased "
                    "by passing a larger value to the `timeout` parameter "
                    "and can be disabled altogether by passing `None`."
                )
                if timeout is not None
                else (
                    "The request timed out. The timeout can be adjusted by "
                    "passing a number of seconds to the `timeout` parameter "
                    "and can be disabled altogether by passing `None`."
                )
            )
            raise TimeoutError(error_message) from error
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
            List[Evaluations]:
                A list of Evaluations objects containing evaluation data. Returns an
                empty list if no evaluations are found.
        """
        project_name = project_name or get_env_project_name()
        response = self._client.get(
            url=urljoin(self._base_url, "v1/evaluations"),
            params={
                "project_name": project_name,
                "project-name": project_name,  # for backward-compatibility
            },
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
            response = self._client.post(
                url=urljoin(self._base_url, "v1/traces"),
                content=content,
                headers={
                    "content-type": "application/x-protobuf",
                    "content-encoding": "gzip",
                },
            )
            response.raise_for_status()

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
            urljoin(self._base_url, "v1/datasets"),
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
            urljoin(self._base_url, f"v1/datasets/{quote(id)}/examples"),
            params={"version_id": version_id} if version_id else None,
        )
        response.raise_for_status()
        data = response.json()["data"]
        examples = {
            example["id"]: Example(
                id=example["id"],
                input=example["input"],
                output=example["output"],
                metadata=example["metadata"],
                updated_at=datetime.fromisoformat(example["updated_at"]),
            )
            for example in data["examples"]
        }
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
        df["created_at"] = df["created_at"].apply(datetime.fromisoformat)
        return df

    def upload_dataset(
        self,
        *,
        dataset_name: str,
        dataframe: Optional[pd.DataFrame] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        inputs: Iterable[Mapping[str, Any]] = (),
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        dataset_description: Optional[str] = None,
    ) -> Dataset:
        """
        Upload examples as dataset to the Phoenix server. If `dataframe` or
        `csv_file_path` are provided, must also provide `input_keys` (and
        optionally with `output_keys` or `metadata_keys` or both), which is a
        list of strings denoting the column names in the dataframe or the csv
        file. On the other hand, a sequence of dictionaries can also be provided
        via `inputs` (and optionally with `outputs` or `metadat` or both), each
        item of which represents a separate example in the dataset.

        Args:
            dataset_name: (str): Name of the dataset.
            dataframe (pd.DataFrame): pandas DataFrame.
            csv_file_path (str | Path): Location of a CSV text file
            input_keys (Iterable[str]): List of column names used as input keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            output_keys (Iterable[str]): List of column names used as output keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            metadata_keys (Iterable[str]): List of column names used as metadata keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
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
        if dataframe is not None or csv_file_path is not None:
            if dataframe is not None and csv_file_path is not None:
                raise ValueError(
                    "Please provide either `dataframe` or `csv_file_path`, but not both"
                )
            if list(inputs) or list(outputs) or list(metadata):
                option = "dataframe" if dataframe is not None else "csv_file_path"
                raise ValueError(
                    f"Please provide only either `{option}` or list of dictionaries "
                    f"via `inputs` (with `outputs` and `metadata`) but not both."
                )
            table = dataframe if dataframe is not None else csv_file_path
            assert table is not None  # for type-checker
            return self._upload_tabular_dataset(
                table,
                dataset_name=dataset_name,
                input_keys=input_keys,
                output_keys=output_keys,
                metadata_keys=metadata_keys,
                dataset_description=dataset_description,
            )
        return self._upload_json_dataset(
            dataset_name=dataset_name,
            inputs=inputs,
            outputs=outputs,
            metadata=metadata,
            dataset_description=dataset_description,
        )

    def append_to_dataset(
        self,
        *,
        dataset_name: str,
        dataframe: Optional[pd.DataFrame] = None,
        csv_file_path: Optional[Union[str, Path]] = None,
        input_keys: Iterable[str] = (),
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        inputs: Iterable[Mapping[str, Any]] = (),
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
    ) -> Dataset:
        """
        Append examples to dataset on the Phoenix server. If `dataframe` or
        `csv_file_path` are provided, must also provide `input_keys` (and
        optionally with `output_keys` or `metadata_keys` or both), which is a
        list of strings denoting the column names in the dataframe or the csv
        file. On the other hand, a sequence of dictionaries can also be provided
        via `inputs` (and optionally with `outputs` or `metadat` or both), each
        item of which represents a separate example in the dataset.

        Args:
            dataset_name: (str): Name of the dataset.
            dataframe (pd.DataFrame): pandas DataFrame.
            csv_file_path (str | Path): Location of a CSV text file
            input_keys (Iterable[str]): List of column names used as input keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            output_keys (Iterable[str]): List of column names used as output keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            metadata_keys (Iterable[str]): List of column names used as metadata keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            inputs (Iterable[Mapping[str, Any]]): List of dictionaries object each
                corresponding to an example in the dataset.
            outputs (Iterable[Mapping[str, Any]]): List of dictionaries object each
                corresponding to an example in the dataset.
            metadata (Iterable[Mapping[str, Any]]): List of dictionaries object each
                corresponding to an example in the dataset.

        Returns:
            A Dataset object with its examples.
        """
        if dataframe is not None or csv_file_path is not None:
            if dataframe is not None and csv_file_path is not None:
                raise ValueError(
                    "Please provide either `dataframe` or `csv_file_path`, but not both"
                )
            if list(inputs) or list(outputs) or list(metadata):
                option = "dataframe" if dataframe is not None else "csv_file_path"
                raise ValueError(
                    f"Please provide only either `{option}` or list of dictionaries "
                    f"via `inputs` (with `outputs` and `metadata`) but not both."
                )
            table = dataframe if dataframe is not None else csv_file_path
            assert table is not None  # for type-checker
            return self._upload_tabular_dataset(
                table,
                dataset_name=dataset_name,
                input_keys=input_keys,
                output_keys=output_keys,
                metadata_keys=metadata_keys,
                action="append",
            )
        return self._upload_json_dataset(
            dataset_name=dataset_name,
            inputs=inputs,
            outputs=outputs,
            metadata=metadata,
            action="append",
        )

    def get_experiment(self, *, experiment_id: str) -> Experiment:
        """
        Get an experiment by ID.

        Retrieve an Experiment object by ID, enables running `evaluate_experiment` after finishing
        the initial experiment run.

        Args:
            experiment_id (str): ID of the experiment. This can be found in the UI.
        """
        response = self._client.get(
            url=urljoin(self._base_url, f"v1/experiments/{experiment_id}"),
        )
        experiment = response.json()["data"]
        return Experiment.from_dict(experiment)

    def _upload_tabular_dataset(
        self,
        table: Union[str, Path, pd.DataFrame],
        /,
        *,
        dataset_name: str,
        input_keys: Iterable[str],
        output_keys: Iterable[str] = (),
        metadata_keys: Iterable[str] = (),
        dataset_description: Optional[str] = None,
        action: DatasetAction = "create",
    ) -> Dataset:
        """
        Upload examples as dataset to the Phoenix server.

        Args:
            table (str | Path | pd.DataFrame): Location of a CSV text file, or
                pandas DataFrame.
            dataset_name: (str): Name of the dataset. Required if action=append.
            input_keys (Iterable[str]): List of column names used as input keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            output_keys (Iterable[str]): List of column names used as output keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            metadata_keys (Iterable[str]): List of column names used as metadata keys.
                input_keys, output_keys, metadata_keys must be disjoint, and must
                exist in CSV column headers.
            dataset_description: (Optional[str]): Description of the dataset.
            action: (Literal["create", "append"]): Create new dataset or append to an
                existing one. If action="append" and dataset does not exist, it'll
                be created.

        Returns:
            A Dataset object with the uploaded examples.
        """
        if action not in ("create", "append"):
            raise ValueError(f"Invalid action: {action}")
        if not dataset_name:
            raise ValueError("Dataset name must not be blank")
        input_keys, output_keys, metadata_keys = (
            (keys,) if isinstance(keys, str) else (keys or ())
            for keys in (input_keys, output_keys, metadata_keys)
        )
        if not any(map(bool, (input_keys, output_keys, metadata_keys))):
            input_keys, output_keys, metadata_keys = _infer_keys(table)
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
                "name": dataset_name,
                "description": dataset_description,
                "input_keys[]": sorted(keys.input),
                "output_keys[]": sorted(keys.output),
                "metadata_keys[]": sorted(keys.metadata),
            },
            params={"sync": True},
        )
        return self._process_dataset_upload_response(response)

    def _upload_json_dataset(
        self,
        *,
        dataset_name: str,
        inputs: Iterable[Mapping[str, Any]],
        outputs: Iterable[Mapping[str, Any]] = (),
        metadata: Iterable[Mapping[str, Any]] = (),
        dataset_description: Optional[str] = None,
        action: DatasetAction = "create",
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
            action: (Literal["create", "append"]): Create new dataset or append to an
                existing one. If action="append" and dataset does not exist, it'll
                be created.

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
        return self._process_dataset_upload_response(response)

    def _process_dataset_upload_response(self, response: Response) -> Dataset:
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
            examples={
                example["id"]: Example(
                    id=example["id"],
                    input=example["input"],
                    output=example["output"],
                    metadata=example["metadata"],
                    updated_at=datetime.fromisoformat(example["updated_at"]),
                )
                for example in examples
            },
        )


FileName: TypeAlias = str
FilePointer: TypeAlias = BinaryIO
FileType: TypeAlias = str
FileHeaders: TypeAlias = Dict[str, str]


def _get_csv_column_headers(path: Path) -> Tuple[str, ...]:
    path = path.resolve()
    if not path.is_file():
        raise FileNotFoundError(f"File does not exist: {path}")
    with open(path, "r") as f:
        rows = csv.reader(f)
        try:
            column_headers = tuple(next(rows))
            _ = next(rows)
        except StopIteration:
            raise ValueError("csv file has no data")
    return column_headers


def _prepare_csv(
    path: Path,
    keys: DatasetKeys,
) -> Tuple[FileName, FilePointer, FileType, FileHeaders]:
    column_headers = _get_csv_column_headers(path)
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


_response_header = re.compile(r"(?i)(response|answer|output)s*$")


def _infer_keys(
    table: Union[str, Path, pd.DataFrame],
) -> Tuple[Tuple[str, ...], Tuple[str, ...], Tuple[str, ...]]:
    column_headers = (
        tuple(table.columns)
        if isinstance(table, pd.DataFrame)
        else _get_csv_column_headers(Path(table))
    )
    for i, header in enumerate(column_headers):
        if _response_header.search(header):
            break
    else:
        i = len(column_headers)
    return (
        column_headers[:i],
        column_headers[i : i + 1],
        column_headers[i + 1 :],
    )


def _to_iso_format(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _is_all_dict(seq: Sequence[Any]) -> bool:
    return all(map(lambda obj: isinstance(obj, dict), seq))


class DatasetUploadError(Exception): ...


class TimeoutError(Exception): ...
