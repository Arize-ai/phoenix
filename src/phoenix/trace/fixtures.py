from dataclasses import dataclass, field
from typing import Iterable, Iterator, List, NamedTuple, Optional, Tuple, cast
from urllib import request

import pandas as pd
from google.protobuf.wrappers_pb2 import DoubleValue, StringValue

import phoenix.trace.v1 as pb
from phoenix.trace.trace_dataset import TraceDataset
from phoenix.trace.utils import json_lines_to_df


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
class TracesFixture:
    name: str
    description: str
    file_name: str
    evaluation_fixtures: Iterable[EvaluationFixture] = ()


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
)

llama_index_calculator_agent_fixture = TracesFixture(
    name="llama_index_calculator_agent",
    description="Traces from running the llama_index with calculator tools.",
    file_name="llama_index_calculator_agent_v2.jsonl",
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


def _get_trace_fixture_by_name(fixture_name: str) -> TracesFixture:
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


def _download_traces_fixture(
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


def load_example_traces(use_case: str) -> TraceDataset:
    """
    Loads a trace dataframe by name.

    NB: this functionality is under active construction.
    """
    fixture = _get_trace_fixture_by_name(use_case)
    return TraceDataset(json_lines_to_df(_download_traces_fixture(fixture)))


def get_evals_from_fixture(use_case: str) -> Iterator[pb.Evaluation]:
    fixture = _get_trace_fixture_by_name(use_case)
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
            subject_id = pb.Evaluation.SubjectId(
                document_retrieval_id=pb.Evaluation.SubjectId.DocumentRetrievalId(
                    document_position=document_position,
                    span_id=span_id,
                ),
            )
        else:
            span_id = cast(str, index)
            subject_id = pb.Evaluation.SubjectId(span_id=span_id)
        yield pb.Evaluation(
            name=eval_fixture.evaluation_name,
            result=result,
            subject_id=subject_id,
        )


def _url(
    file_name: str,
    host: Optional[str] = "https://storage.googleapis.com/",
    bucket: Optional[str] = "arize-assets",
    prefix: Optional[str] = "phoenix/traces/",
) -> str:
    return f"{host}{bucket}/{prefix}{file_name}"
