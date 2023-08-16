from dataclasses import dataclass
from typing import List, Optional

import pandas as pd

from phoenix.trace.trace_dataset import TraceDataset
from phoenix.trace.utils import json_lines_to_df


@dataclass(frozen=True)
class TracesFixture:
    name: str
    description: str
    file_name: str


random_fixture = TracesFixture(
    name="random",
    description="Randomly generated traces",
    file_name="random.jsonl",
)

TRACES_FIXTURES: List[TracesFixture] = [random_fixture]

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
    with open("/Users/rogeryang/random.jsonl", "r") as f:
        return json_lines_to_df(f.readlines())


def load_example_traces(use_case: str) -> TraceDataset:
    """
    Loads a trace dataframe by name.

    NB: this functionality is under active construction.
    """
    fixture = _get_trace_fixture_by_name(use_case)
    return TraceDataset(_download_traces_fixture(fixture))
