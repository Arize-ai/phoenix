from dataclasses import dataclass
from typing import List, Optional
from urllib import request

import pandas as pd

from phoenix.trace.trace_dataset import TraceDataset
from phoenix.trace.utils import json_lines_to_df


@dataclass(frozen=True)
class TracesFixture:
    name: str
    description: str
    file_name: str


llama_index_rag_fixture = TracesFixture(
    name="llama_index_rag",
    description="Traces from running the llama_index on a RAG use case.",
    file_name="llama_index_rag.jsonl",
)
langchain_rag_fixture = TracesFixture(
    name="langchain_rag",
    description="LangChain RAG data",
    file_name="langchain_rag.jsonl",
)

random_fixture = TracesFixture(
    name="random",
    description="Randomly generated traces",
    file_name="random.jsonl",
)

TRACES_FIXTURES: List[TracesFixture] = [
    llama_index_rag_fixture,
    langchain_rag_fixture,
    random_fixture,
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
) -> pd.DataFrame:
    """
    Downloads the traces fixture from the phoenix bucket.
    """
    url = f"{host}{bucket}/{prefix}{fixture.file_name}"
    with request.urlopen(url) as f:
        df = json_lines_to_df(f.readlines()).head(2)
        print("HEAD")
        return df


def load_example_traces(use_case: str) -> TraceDataset:
    """
    Loads a trace dataframe by name.

    NB: this functionality is under active construction.
    """
    fixture = _get_trace_fixture_by_name(use_case)
    return TraceDataset(_download_traces_fixture(fixture))
