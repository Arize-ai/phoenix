import gzip
import logging
from binascii import hexlify
from collections import Counter, defaultdict
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from io import BytesIO, StringIO
from random import getrandbits
from time import sleep, time
from typing import (
    NamedTuple,
    Optional,
    cast,
)
from urllib.parse import urljoin

import httpx
import pandas as pd
import pyarrow as pa
from httpx import ConnectError, HTTPStatusError
from pyarrow import Table

from phoenix.db.insertion.dataset import DatasetKeys
from phoenix.db.insertion.types import AnnotationPrecursor, Precursors
from phoenix.trace.schemas import Span
from phoenix.trace.span_evaluations import (
    DocumentEvaluations,
    Evaluations,
    SpanEvaluations,
    TraceEvaluations,
)
from phoenix.trace.trace_dataset import TraceDataset
from phoenix.trace.utils import (
    download_json_traces_fixture,
    json_lines_to_df,
    parse_file_extension,
)


def _prepare_pyarrow(
    df: pd.DataFrame,
    keys: DatasetKeys,
) -> tuple[str, BytesIO, str, dict[str, str]]:
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
    return "pandas", BytesIO(sink.getvalue().to_pybytes()), "application/x-pandas-pyarrow", {}


def _prepare_csv_bytes(
    csv_content: StringIO,
    name: str,
    keys: DatasetKeys,
) -> tuple[str, BytesIO, str, dict[str, str]]:
    raw = csv_content.read().encode("utf-8")
    lines = raw.splitlines()
    if len(lines) < 2:
        raise ValueError("csv file has no data")
    column_headers = tuple(line.decode("utf-8") for line in lines[0].split(b","))
    (header, freq), *_ = Counter(column_headers).most_common(1)
    if freq > 1:
        raise ValueError(f"Duplicated column header in CSV file: {header}")
    keys.check_differences(frozenset(column_headers))
    compressed = BytesIO(gzip.compress(raw))
    return name, compressed, "text/csv", {"Content-Encoding": "gzip"}


logger = logging.getLogger(__name__)


class EvaluationResultSchema(NamedTuple):
    label: Optional[str] = "label"
    score: Optional[str] = "score"
    explanation: Optional[str] = "explanation"


@dataclass(frozen=True)
class EvaluationFixture:
    evaluation_name: str
    file_name: str
    evaluation_result_schema: EvaluationResultSchema = field(default_factory=EvaluationResultSchema)


@dataclass(frozen=True)
class DocumentEvaluationFixture(EvaluationFixture):
    document_position: str = "document_position"


@dataclass(frozen=True)
class DatasetFixture:
    file_name: str
    name: str
    input_keys: Sequence[str]
    output_keys: Sequence[str]
    metadata_keys: Sequence[str] = ()
    description: Optional[str] = field(default=None)
    _df: Optional[pd.DataFrame] = field(default=None, init=False, repr=False)
    _csv: Optional[str] = field(default=None, init=False, repr=False)

    def load(self) -> "DatasetFixture":
        if self._df is None:
            url = _url(self.file_name)

            if parse_file_extension(self.file_name) == ".jsonl":
                df = json_lines_to_df(download_json_traces_fixture(url))
            elif parse_file_extension(self.file_name) == ".csv":
                df = pd.read_csv(_url(self.file_name))
            else:
                try:
                    df = pd.read_parquet(url)
                except Exception:
                    logger.warning(
                        f"Failed to download example traces from {url=} "
                        "due to exception {e=}. "
                        "Returning empty dataframe for DatasetFixture"
                    )
                    df = pd.DataFrame()

            object.__setattr__(self, "_df", df)
        return self

    @property
    def dataframe(self) -> pd.DataFrame:
        self.load()
        return cast(pd.DataFrame, self._df).copy(deep=False)

    @property
    def csv(self) -> StringIO:
        if self._csv is None:
            with StringIO() as buffer:
                self.dataframe.to_csv(buffer, index=False)
                object.__setattr__(self, "_csv", buffer.getvalue())
        return StringIO(self._csv)


@dataclass(frozen=True)
class TracesFixture:
    name: str
    description: str
    file_name: str
    evaluation_fixtures: Iterable[EvaluationFixture] = ()
    dataset_fixtures: Iterable[DatasetFixture] = ()
    project_name: Optional[str] = None


demo_llama_index_rag_fixture = TracesFixture(
    name="demo_llama_index_rag",
    project_name="demo_llama_index",
    description="Traces and evaluations of a RAG chatbot using LlamaIndex.",
    file_name="demo_llama_index_rag_traces.parquet",
    evaluation_fixtures=(
        EvaluationFixture(
            evaluation_name="Q&A Correctness",
            file_name="demo_llama_index_rag_qa_correctness_eval.parquet",
        ),
        EvaluationFixture(
            evaluation_name="Hallucination",
            file_name="demo_llama_index_rag_hallucination_eval.parquet",
        ),
        DocumentEvaluationFixture(
            evaluation_name="Relevance",
            file_name="demo_llama_index_rag_doc_relevance_eval.parquet",
        ),
    ),
    dataset_fixtures=(
        DatasetFixture(
            file_name="demo_llama_index_finetune_dataset.jsonl",
            input_keys=("messages",),
            output_keys=("messages",),
            name="Demo LlamaIndex: RAG Q&A",
            description="OpenAI GPT-3.5 LLM dataset for LlamaIndex demo",
        ),
    ),
)

demo_toolcalling_fixture = TracesFixture(
    name="demo_toolcalling",
    project_name="demo_agent",
    description="Tool calling traces",
    file_name="agents-toolcalling-tracesv2.parquet",
    dataset_fixtures=(
        DatasetFixture(
            file_name="questions.csv.gz",
            input_keys=("query",),
            output_keys=("responses",),
            name="Valid Queries",
            description="Valid queries for the demo agent",
        ),
        DatasetFixture(
            file_name="invalid_questions.csv.gz",
            input_keys=("query",),
            output_keys=("responses",),
            name="Invalid Queries",
            description="Invalid queries for the demo agent",
        ),
    ),
)

demo_code_based_agent_fixture = TracesFixture(
    name="demo_code_based_agent",
    project_name="demo_agents",
    description="LangGraph, LlamaIndex, and Code-based agent traces",
    file_name="agent-demo-traces.parquet",
)
demo_langgraph_agent_fixture = TracesFixture(
    name="demo_langgraph_agent",
    project_name="demo_agents",
    description="LangGraph, LlamaIndex, and Code-based agent traces",
    file_name="langgraph-demo-traces-format-updated.parquet",
)
demo_llamaindex_workflows_agent_fixture = TracesFixture(
    name="demo_llamaindex_workflows_agent",
    project_name="demo_agents",
    description="LangGraph, LlamaIndex, and Code-based agent traces",
    file_name="llamaindex-workflow-demo-traces.parquet",
)

demo_o1_preview_timeseries_testing_fixture = TracesFixture(
    name="demo_o1_preview_timeseries_evals",
    project_name="demo_o1_preview_timeseries",
    description="Shows the traces for a timeseries evaluation of o1-preview",
    file_name="o1-traces-preview-testing.parquet",
)

demo_llama_index_rag_llm_fixture = TracesFixture(
    name="demo_llama_index_rag_llm",
    project_name="demo_llama_index_rag_llm",
    description="LLM traces for RAG chatbot using LlamaIndex.",
    file_name="demo_llama_index_llm_all_spans.parquet",
)

llama_index_rag_fixture = TracesFixture(
    name="llama_index_rag",
    description="Traces from running the llama_index on a RAG use case.",
    file_name="llama_index_rag_v8.parquet",
    evaluation_fixtures=(
        EvaluationFixture(
            evaluation_name="Q&A Correctness",
            file_name="llama_index_rag_v8.qa_correctness_eval.parquet",
        ),
        EvaluationFixture(
            evaluation_name="Hallucination",
            file_name="llama_index_rag_v8.hallucination_eval.parquet",
        ),
        DocumentEvaluationFixture(
            evaluation_name="Relevance",
            file_name="llama_index_rag_v8.retrieved_documents_eval.parquet",
        ),
    ),
    dataset_fixtures=(
        DatasetFixture(
            file_name="hybridial_samples.csv.gz",
            input_keys=("messages", "ctxs"),
            output_keys=("answers",),
            name="ChatRAG-Bench: Hybrid Dialogue (samples)",
            description="https://huggingface.co/datasets/nvidia/ChatRAG-Bench/viewer/hybridial",
        ),
        DatasetFixture(
            file_name="sqa_samples.csv.gz",
            input_keys=("messages", "ctxs"),
            output_keys=("answers",),
            name="ChatRAG-Bench: SQA (samples)",
            description="https://huggingface.co/datasets/nvidia/ChatRAG-Bench/viewer/sqa",
        ),
        DatasetFixture(
            file_name="doqa_cooking_samples.csv.gz",
            input_keys=("messages", "ctxs"),
            output_keys=("answers",),
            name="ChatRAG-Bench: DoQA Cooking (samples)",
            description="https://huggingface.co/datasets/nvidia/ChatRAG-Bench/viewer/doqa_cooking",
        ),
        DatasetFixture(
            file_name="synthetic_convqa_samples.csv.gz",
            input_keys=("messages", "document"),
            output_keys=("answers",),
            name="ChatQA-Train: Synthetic ConvQA (samples)",
            description="https://huggingface.co/datasets/nvidia/ChatQA-Training-Data/viewer/synthetic_convqa",
        ),
    ),
)

project_sessions_llama_index_rag_arize_docs_fixture = TracesFixture(
    name="project_sessions_llama_index_rag_arize_docs",
    project_name="SESSIONS-DEMO",
    file_name="project_sessions_demo_llama_index_query_engine_arize_docs.parquet",
    description="RAG queries grouped by session.id and user.id.",
)

llama_index_calculator_agent_fixture = TracesFixture(
    name="llama_index_calculator_agent",
    description="Traces from running the llama_index with calculator tools.",
    file_name="llama_index_calculator_agent_v3.parquet",
)

llama_index_rag_fixture_with_davinci = TracesFixture(
    name="llama_index_rag_with_davinci",
    description="Traces from running llama_index on a RAG use case with the completions API.",
    file_name="llama_index_rag_with_davinci_v0.parquet",
)

langchain_rag_stuff_document_chain_fixture = TracesFixture(
    name="langchain_rag_stuff_document_chain",
    project_name="demo_langchain_rag",
    description="LangChain RAG data",
    file_name="langchain_rag.parquet",
)

langchain_titanic_csv_agent_evaluator_fixture = TracesFixture(
    name="lc_titanic",
    description="LangChain titanic.csv Agent Evaluator",
    file_name="lc_titanic.parquet",
)

langchain_qa_with_sources_fixture = TracesFixture(
    name="langchain_qa_with_sources",
    description="LangChain QA with sources on financial data",
    file_name="langchain_qa_with_sources_chain.parquet",
)

vision_fixture = TracesFixture(
    name="vision",
    project_name="demo_multimodal",
    description="Vision LLM Requests",
    file_name="vision_fixture_trace_datasets.parquet",
)

anthropic_tools_fixture = TracesFixture(
    name="anthropic_tools",
    project_name="anthropic_tools",
    description="Anthropic tools traces",
    file_name="anthropic_tools.parquet",
)

random_fixture = TracesFixture(
    name="random",
    project_name="demo_random",
    description="Randomly generated traces",
    file_name="random.jsonl",
)

TRACES_FIXTURES: list[TracesFixture] = [
    demo_llama_index_rag_fixture,
    demo_llama_index_rag_llm_fixture,
    demo_langgraph_agent_fixture,
    demo_code_based_agent_fixture,
    demo_llamaindex_workflows_agent_fixture,
    demo_o1_preview_timeseries_testing_fixture,
    llama_index_rag_fixture,
    llama_index_rag_fixture_with_davinci,
    langchain_rag_stuff_document_chain_fixture,
    langchain_titanic_csv_agent_evaluator_fixture,
    random_fixture,
    langchain_qa_with_sources_fixture,
    llama_index_calculator_agent_fixture,
    vision_fixture,
    anthropic_tools_fixture,
    project_sessions_llama_index_rag_arize_docs_fixture,
    demo_toolcalling_fixture,
]

NAME_TO_TRACES_FIXTURE: dict[str, TracesFixture] = {
    fixture.name: fixture for fixture in TRACES_FIXTURES
}
PROJ_NAME_TO_TRACES_FIXTURE: defaultdict[str, list[TracesFixture]] = defaultdict(list)
for fixture in TRACES_FIXTURES:
    if fixture.project_name:
        PROJ_NAME_TO_TRACES_FIXTURE[fixture.project_name].append(fixture)


def get_trace_fixture_by_name(fixture_name: str) -> TracesFixture:
    """
    Returns the trace fixture whose name matches the input name.

    Raises
    ------
    ValueError
        if the input fixture name does not match any known fixture names.
    """
    if fixture_name not in NAME_TO_TRACES_FIXTURE:
        valid_fixture_names = ", ".join(NAME_TO_TRACES_FIXTURE.keys())
        raise ValueError(f'"{fixture_name}" is invalid. Valid names are: {valid_fixture_names}')
    return NAME_TO_TRACES_FIXTURE[fixture_name]


def get_trace_fixtures_by_project_name(proj_name: str) -> list[TracesFixture]:
    """
    Returns a dictionary of project name (key) and set of TracesFixtures (value)
    whose project name matches the input name.

    Raises
    ------
    ValueError
        if the input fixture name does not match any known project names.
    """
    if proj_name not in PROJ_NAME_TO_TRACES_FIXTURE:
        valid_fixture_proj_names = ", ".join(PROJ_NAME_TO_TRACES_FIXTURE.keys())
        raise ValueError(
            f'"{proj_name}" is invalid. Valid project names are: {valid_fixture_proj_names}'
        )
    return PROJ_NAME_TO_TRACES_FIXTURE[proj_name]


def load_example_traces(fixture_name: str) -> TraceDataset:
    """
    Loads a trace dataframe by name.
    """
    fixture = get_trace_fixture_by_name(fixture_name)
    url = _url(fixture.file_name)

    if parse_file_extension(fixture.file_name) == ".jsonl":
        return TraceDataset(json_lines_to_df(download_json_traces_fixture(url)))

    try:
        df = pd.read_parquet(url)
    except Exception as e:
        logger.warning(
            f"Failed to download example traces from {url=} due to exception {e=}. "
            "Returning empty TraceDataset"
        )
        df = pd.DataFrame()

    return TraceDataset(df)


def get_dataset_fixtures(fixture_name: str) -> Iterable[DatasetFixture]:
    return (fixture.load() for fixture in get_trace_fixture_by_name(fixture_name).dataset_fixtures)


def send_dataset_fixtures(
    endpoint: str,
    fixtures: Iterable[DatasetFixture],
) -> None:
    expiration = time() + 5
    while time() < expiration:
        try:
            url = urljoin(endpoint, "/healthz")
            httpx.get(url=url).raise_for_status()
        except ConnectError:
            sleep(0.1)
            continue
        except Exception as e:
            print(str(e))
            raise
        break
    upload_url = urljoin(endpoint, "v1/datasets/upload")
    for i, fixture in enumerate(fixtures):
        keys = DatasetKeys(
            frozenset(fixture.input_keys),
            frozenset(fixture.output_keys),
            frozenset(fixture.metadata_keys),
        )
        try:
            if i % 2:
                fname, fdata, ftype, fheaders = _prepare_pyarrow(fixture.dataframe, keys)
            else:
                fname, fdata, ftype, fheaders = _prepare_csv_bytes(fixture.csv, fixture.name, keys)
            httpx.post(
                url=upload_url,
                files={"file": (fname, fdata, ftype, fheaders)},
                data={
                    "action": "create",
                    "name": fixture.name,
                    "description": fixture.description,
                    "input_keys[]": sorted(keys.input),
                    "output_keys[]": sorted(keys.output),
                    "metadata_keys[]": sorted(keys.metadata),
                },
                params={"sync": True},
            ).raise_for_status()
        except HTTPStatusError as e:
            print(e.response.content.decode())
        else:
            name, df = fixture.name, fixture.dataframe
            print(f"Dataset sent: {name=}, {len(df)=}")


def _read_eval_fixture_dataframe(eval_fixture: EvaluationFixture) -> pd.DataFrame:
    """Read an evaluation fixture parquet file and return it as a DataFrame.

    The returned DataFrame has columns: score, label, explanation.
    For span evaluations, the index is span_id.
    For document evaluations, the index is (span_id, document_position).
    Legacy UUID-style span_ids have hyphens removed.
    """
    df = pd.read_parquet(_url(eval_fixture.file_name))
    schema = eval_fixture.evaluation_result_schema
    # Rename columns to canonical names if needed
    rename_map: dict[str, str] = {}
    if schema.score and schema.score != "score":
        rename_map[schema.score] = "score"
    if schema.label and schema.label != "label":
        rename_map[schema.label] = "label"
    if schema.explanation and schema.explanation != "explanation":
        rename_map[schema.explanation] = "explanation"
    if rename_map:
        df = df.rename(columns=rename_map)
    # Strip hyphens from span_id index values (legacy UUID format)
    if isinstance(df.index, pd.MultiIndex):
        # Document evaluation: (span_id, document_position)
        new_levels = []
        for i, name in enumerate(df.index.names):
            level_values = df.index.get_level_values(i)
            if name in ("span_id", "context.span_id"):
                level_values = level_values.map(
                    lambda x: x.replace("-", "") if isinstance(x, str) else x
                )
            new_levels.append(level_values)
        df.index = pd.MultiIndex.from_arrays(new_levels, names=df.index.names)
    else:
        # Span evaluation: span_id index
        if df.index.name in ("span_id", "context.span_id", None):
            df.index = df.index.map(lambda x: x.replace("-", "") if isinstance(x, str) else x)
    return df


def _url(
    file_name: str,
    host: Optional[str] = "https://storage.googleapis.com/",
    bucket: Optional[str] = "arize-phoenix-assets",
    prefix: Optional[str] = "traces/",
) -> str:
    return f"{host}{bucket}/{prefix}{file_name}"


def reset_fixture_span_ids_and_timestamps(
    spans: Iterable[Span],
) -> tuple[list[Span], dict[str, str], dict[str, str]]:
    old_spans = list(spans)
    new_trace_ids: dict[str, str] = {}
    new_span_ids: dict[str, str] = {}
    for old_span in old_spans:
        new_trace_ids[old_span.context.trace_id] = _new_trace_id()
        new_span_ids[old_span.context.span_id] = _new_span_id()
        if old_span.parent_id:
            new_span_ids[old_span.parent_id] = _new_span_id()
    max_end_time = max(old_span.end_time for old_span in old_spans)
    time_diff = datetime.now(timezone.utc) - max_end_time
    new_spans: list[Span] = []
    for old_span in old_spans:
        new_trace_id = new_trace_ids[old_span.context.trace_id]
        new_span_id = new_span_ids[old_span.context.span_id]
        new_parent_id = new_span_ids[old_span.parent_id] if old_span.parent_id else None
        new_span = replace(
            old_span,
            context=replace(old_span.context, trace_id=new_trace_id, span_id=new_span_id),
            parent_id=new_parent_id,
            start_time=old_span.start_time + time_diff,
            end_time=old_span.end_time + time_diff,
        )
        new_spans.append(new_span)
    return new_spans, new_trace_ids, new_span_ids


def get_annotation_precursors_from_fixture(
    fixture_name: str,
) -> Iterator[tuple[str, list[AnnotationPrecursor]]]:
    from phoenix.db import models

    fixture = get_trace_fixture_by_name(fixture_name)
    for eval_fixture in fixture.evaluation_fixtures:
        logger.info(
            f"Loading eval fixture '{eval_fixture.evaluation_name}' from '{eval_fixture.file_name}'"
        )
        df = _read_eval_fixture_dataframe(eval_fixture)
        eval_name = eval_fixture.evaluation_name
        precursors: list[AnnotationPrecursor] = []
        now = datetime.now(timezone.utc)
        if isinstance(eval_fixture, DocumentEvaluationFixture):
            for index, row in df.iterrows():
                span_id, document_position = cast(tuple[str, int], index)
                score, label, explanation = _get_precursor_result(row)
                precursors.append(
                    Precursors.DocumentAnnotation(
                        updated_at=now,
                        span_id=str(span_id),
                        document_position=int(document_position),
                        obj=models.DocumentAnnotation(
                            document_position=int(document_position),
                            name=eval_name,
                            identifier="",
                            source="API",
                            annotator_kind="LLM",
                            score=score,
                            label=label,
                            explanation=explanation,
                            metadata_={},
                        ),
                    )
                )
        else:
            is_trace = False
            for evaluations_cls in (SpanEvaluations, TraceEvaluations):
                try:
                    evaluations_cls(eval_name=eval_name, dataframe=df)
                    is_trace = evaluations_cls is TraceEvaluations
                    break
                except ValueError:
                    continue
            else:
                raise ValueError(
                    f"Could not infer evaluation type for fixture '{eval_name}' "
                    f"with index {df.index.names!r}"
                )
            for index, row in df.iterrows():
                score, label, explanation = _get_precursor_result(row)
                if is_trace:
                    precursors.append(
                        Precursors.TraceAnnotation(
                            updated_at=now,
                            trace_id=str(index),
                            obj=models.TraceAnnotation(
                                name=eval_name,
                                identifier="",
                                source="API",
                                annotator_kind="LLM",
                                score=score,
                                label=label,
                                explanation=explanation,
                                metadata_={},
                            ),
                        )
                    )
                else:
                    precursors.append(
                        Precursors.SpanAnnotation(
                            updated_at=now,
                            span_id=str(index),
                            obj=models.SpanAnnotation(
                                name=eval_name,
                                identifier="",
                                source="API",
                                annotator_kind="LLM",
                                score=score,
                                label=label,
                                explanation=explanation,
                                metadata_={},
                            ),
                        )
                    )
        yield eval_name, precursors


def _get_precursor_result(
    row: "pd.Series[str]",
) -> tuple[Optional[float], Optional[str], Optional[str]]:
    return (
        cast(Optional[float], row.get("score")),
        cast(Optional[str], row.get("label")),
        cast(Optional[str], row.get("explanation")),
    )


def remap_precursor_ids(
    precursor: AnnotationPrecursor,
    *,
    trace_id_mapping: dict[str, str],
    span_id_mapping: dict[str, str],
) -> AnnotationPrecursor:
    if isinstance(precursor, Precursors.DocumentAnnotation):
        new_span_id = span_id_mapping.get(precursor.span_id, precursor.span_id)
        return replace(precursor, span_id=new_span_id)
    if isinstance(precursor, Precursors.SpanAnnotation):
        new_span_id = span_id_mapping.get(precursor.span_id, precursor.span_id)
        return replace(precursor, span_id=new_span_id)
    if isinstance(precursor, Precursors.TraceAnnotation):
        new_trace_id = trace_id_mapping.get(precursor.trace_id, precursor.trace_id)
        return replace(precursor, trace_id=new_trace_id)
    raise TypeError(f"Unsupported precursor type: {type(precursor)!r}")


def evaluations_to_precursors(
    evaluations: Evaluations,
) -> list[AnnotationPrecursor]:
    from phoenix.db import models

    eval_name = evaluations.eval_name
    dataframe = evaluations.dataframe
    now = datetime.now(timezone.utc)
    precursors: list[AnnotationPrecursor] = []

    if isinstance(evaluations, DocumentEvaluations):
        for index, row in dataframe.iterrows():
            span_id, document_position = cast(tuple[str, int], index)
            score, label, explanation = _get_precursor_result(row)
            precursors.append(
                Precursors.DocumentAnnotation(
                    updated_at=now,
                    span_id=str(span_id),
                    document_position=int(document_position),
                    obj=models.DocumentAnnotation(
                        document_position=int(document_position),
                        name=eval_name,
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=score,
                        label=label,
                        explanation=explanation,
                        metadata_={},
                    ),
                )
            )
        return precursors

    if isinstance(evaluations, SpanEvaluations):
        for index, row in dataframe.iterrows():
            score, label, explanation = _get_precursor_result(row)
            precursors.append(
                Precursors.SpanAnnotation(
                    updated_at=now,
                    span_id=str(index),
                    obj=models.SpanAnnotation(
                        name=eval_name,
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=score,
                        label=label,
                        explanation=explanation,
                        metadata_={},
                    ),
                )
            )
        return precursors

    if isinstance(evaluations, TraceEvaluations):
        for index, row in dataframe.iterrows():
            score, label, explanation = _get_precursor_result(row)
            precursors.append(
                Precursors.TraceAnnotation(
                    updated_at=now,
                    trace_id=str(index),
                    obj=models.TraceAnnotation(
                        name=eval_name,
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=score,
                        label=label,
                        explanation=explanation,
                        metadata_={},
                    ),
                )
            )
        return precursors

    raise TypeError(f"Unsupported evaluations type: {type(evaluations)!r}")


def _new_trace_id() -> str:
    return hexlify(getrandbits(128).to_bytes(16, "big")).decode()


def _new_span_id() -> str:
    return hexlify(getrandbits(64).to_bytes(8, "big")).decode()
