import logging
import shutil
from binascii import hexlify
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from io import StringIO
from random import getrandbits
from tempfile import NamedTemporaryFile
from time import sleep, time
from typing import Dict, Iterable, Iterator, List, NamedTuple, Optional, Sequence, Tuple, cast
from urllib import request
from urllib.parse import urljoin

import httpx
import pandas as pd
from google.protobuf.wrappers_pb2 import DoubleValue, StringValue
from httpx import ConnectError, HTTPStatusError

import phoenix.trace.v1 as pb
from phoenix import Client
from phoenix.trace.schemas import Span
from phoenix.trace.trace_dataset import TraceDataset
from phoenix.trace.utils import json_lines_to_df

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
            df = pd.read_csv(_url(self.file_name))
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


llama_index_rag_fixture = TracesFixture(
    name="llama_index_rag",
    description="Traces from running the llama_index on a RAG use case.",
    file_name="llama_index_rag_v8.jsonl",
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

llama_index_calculator_agent_fixture = TracesFixture(
    name="llama_index_calculator_agent",
    description="Traces from running the llama_index with calculator tools.",
    file_name="llama_index_calculator_agent_v3.jsonl",
)

llama_index_rag_fixture_with_davinci = TracesFixture(
    name="llama_index_rag_with_davinci",
    description="Traces from running llama_index on a RAG use case with the completions API.",
    file_name="llama_index_rag_with_davinci_v0.jsonl",
)

langchain_rag_stuff_document_chain_fixture = TracesFixture(
    name="langchain_rag_stuff_document_chain",
    description="LangChain RAG data",
    file_name="langchain_rag.jsonl",
)

langchain_titanic_csv_agent_evaluator_fixture = TracesFixture(
    name="lc_titanic",
    description="LangChain titanic.csv Agent Evaluator",
    file_name="lc_titanic.jsonl",
)

langchain_qa_with_sources_fixture = TracesFixture(
    name="langchain_qa_with_sources",
    description="LangChain QA with sources on financial data",
    file_name="langchain_qa_with_sources_chain.jsonl",
)

random_fixture = TracesFixture(
    name="random",
    description="Randomly generated traces",
    file_name="random.jsonl",
)

TRACES_FIXTURES: List[TracesFixture] = [
    llama_index_rag_fixture,
    llama_index_rag_fixture_with_davinci,
    langchain_rag_stuff_document_chain_fixture,
    langchain_titanic_csv_agent_evaluator_fixture,
    random_fixture,
    langchain_qa_with_sources_fixture,
    llama_index_calculator_agent_fixture,
]

NAME_TO_TRACES_FIXTURE = {fixture.name: fixture for fixture in TRACES_FIXTURES}


def get_trace_fixture_by_name(fixture_name: str) -> TracesFixture:
    """
    Returns the fixture whose name matches the input name.

    Raises
    ------
    ValueError
        if the input fixture name does not match any known fixture names.
    """
    if fixture_name not in NAME_TO_TRACES_FIXTURE:
        valid_fixture_names = ", ".join(NAME_TO_TRACES_FIXTURE.keys())
        raise ValueError(f'"{fixture_name}" is invalid. Valid names are: {valid_fixture_names}')
    return NAME_TO_TRACES_FIXTURE[fixture_name]


def download_traces_fixture(
    fixture: TracesFixture,
    host: Optional[str] = "https://storage.googleapis.com/",
    bucket: Optional[str] = "arize-assets",
    prefix: Optional[str] = "phoenix/traces/",
) -> List[str]:
    """
    Downloads the traces fixture from the phoenix bucket.
    """
    url = f"{host}{bucket}/{prefix}{fixture.file_name}"
    with request.urlopen(url) as f:
        return cast(List[str], f.readlines())


def load_example_traces(fixture_name: str) -> TraceDataset:
    """
    Loads a trace dataframe by name.
    """
    fixture = get_trace_fixture_by_name(fixture_name)
    return TraceDataset(json_lines_to_df(download_traces_fixture(fixture)))


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
    client = Client(endpoint=endpoint)
    for i, fixture in enumerate(fixtures):
        try:
            if i % 2:
                client.upload_dataset(
                    dataset_name=fixture.name,
                    dataframe=fixture.dataframe,
                    input_keys=fixture.input_keys,
                    output_keys=fixture.output_keys,
                    metadata_keys=fixture.metadata_keys,
                    dataset_description=fixture.description,
                )
            else:
                with NamedTemporaryFile() as tf:
                    with open(tf.name, "w") as f:
                        shutil.copyfileobj(fixture.csv, f)
                        f.flush()
                    client.upload_dataset(
                        dataset_name=fixture.name,
                        csv_file_path=tf.name,
                        input_keys=fixture.input_keys,
                        output_keys=fixture.output_keys,
                        metadata_keys=fixture.metadata_keys,
                        dataset_description=fixture.description,
                    )
        except HTTPStatusError as e:
            print(e.response.content.decode())
            pass
        else:
            name, df = fixture.name, fixture.dataframe
            print(f"Dataset sent: {name=}, {len(df)=}")


def get_evals_from_fixture(fixture_name: str) -> Iterator[pb.Evaluation]:
    fixture = get_trace_fixture_by_name(fixture_name)
    for eval_fixture in fixture.evaluation_fixtures:
        yield from _read_eval_fixture(eval_fixture)


def _read_eval_fixture(eval_fixture: EvaluationFixture) -> Iterator[pb.Evaluation]:
    df = pd.read_parquet(_url(eval_fixture.file_name))
    for index, row in df.iterrows():
        schema = eval_fixture.evaluation_result_schema
        label = row.get(schema.label)
        score = row.get(schema.score)
        explanation = row.get(schema.explanation)
        result = pb.Evaluation.Result(
            score=DoubleValue(value=cast(float, score)) if score is not None else None,
            label=StringValue(value=cast(str, label)) if label else None,
            explanation=StringValue(value=cast(str, explanation)) if explanation else None,
        )
        if isinstance(eval_fixture, DocumentEvaluationFixture):
            span_id, document_position = cast(Tuple[str, int], index)
            # Legacy fixture files contain UUID strings for span_ids. The hyphens in these
            # strings need to be removed because we are also removing the hyphens from the
            # span_ids of their corresponding traces. In general, hyphen is not an allowed
            # character in the string representation of span_ids.
            span_id = span_id.replace("-", "")
            subject_id = pb.Evaluation.SubjectId(
                document_retrieval_id=pb.Evaluation.SubjectId.DocumentRetrievalId(
                    document_position=document_position,
                    span_id=span_id,
                ),
            )
        else:
            span_id = cast(str, index)
            # Legacy fixture files contain UUID strings for span_ids. The hyphens in these
            # strings need to be removed because we are also removing the hyphens from the
            # span_ids of their corresponding traces. In general, hyphen is not an allowed
            # character in the string representation of span_ids.
            span_id = span_id.replace("-", "")
            subject_id = pb.Evaluation.SubjectId(span_id=span_id)
        yield pb.Evaluation(
            name=eval_fixture.evaluation_name,
            result=result,
            subject_id=subject_id,
        )


def _url(
    file_name: str,
    host: Optional[str] = "https://storage.googleapis.com/",
    bucket: Optional[str] = "arize-phoenix-assets",
    prefix: Optional[str] = "traces/",
) -> str:
    return f"{host}{bucket}/{prefix}{file_name}"


def reset_fixture_span_ids_and_timestamps(
    spans: Iterable[Span],
    evals: Iterable[pb.Evaluation] = (),
) -> Tuple[List[Span], List[pb.Evaluation]]:
    old_spans, old_evals = list(spans), list(evals)
    new_trace_ids: Dict[str, str] = {}
    new_span_ids: Dict[str, str] = {}
    for old_span in old_spans:
        new_trace_ids[old_span.context.trace_id] = _new_trace_id()
        new_span_ids[old_span.context.span_id] = _new_span_id()
        if old_span.parent_id:
            new_span_ids[old_span.parent_id] = _new_span_id()
    for old_eval in old_evals:
        subject_id = old_eval.subject_id
        if trace_id := subject_id.trace_id:
            new_trace_ids[trace_id] = _new_trace_id()
        elif span_id := subject_id.span_id:
            new_span_ids[span_id] = _new_span_id()
        elif span_id := subject_id.document_retrieval_id.span_id:
            new_span_ids[span_id] = _new_span_id()
    max_end_time = max(old_span.end_time for old_span in old_spans)
    time_diff = datetime.now(timezone.utc) - max_end_time
    new_spans: List[Span] = []
    new_evals: List[pb.Evaluation] = []
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
    for old_eval in old_evals:
        new_eval = pb.Evaluation()
        new_eval.CopyFrom(old_eval)
        subject_id = new_eval.subject_id
        if trace_id := subject_id.trace_id:
            subject_id.trace_id = new_trace_ids[trace_id]
        elif span_id := subject_id.span_id:
            subject_id.span_id = new_span_ids[span_id]
        elif span_id := subject_id.document_retrieval_id.span_id:
            subject_id.document_retrieval_id.span_id = new_span_ids[span_id]
        new_evals.append(new_eval)
    return new_spans, new_evals


def _new_trace_id() -> str:
    return hexlify(getrandbits(128).to_bytes(16, "big")).decode()


def _new_span_id() -> str:
    return hexlify(getrandbits(64).to_bytes(8, "big")).decode()
