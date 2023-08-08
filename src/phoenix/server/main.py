import atexit
import errno
import logging
import os
from argparse import ArgumentParser
from pathlib import Path
from typing import Optional

import uvicorn

import phoenix.config as config
from phoenix.core.model_schema_adapter import create_model_from_datasets
from phoenix.core.traces import Traces
from phoenix.datasets.dataset import EMPTY_DATASET, Dataset
from phoenix.datasets.fixtures import FIXTURES, get_datasets
from phoenix.server.app import create_app
from phoenix.trace.fixtures import TRACES_FIXTURES, load_example_traces

logger = logging.getLogger(__name__)


def _write_pid_file() -> None:
    with open(_get_pid_file(), "w"):
        pass


def _remove_pid_file() -> None:
    try:
        os.unlink(_get_pid_file())
    except OSError as e:
        if e.errno == errno.ENOENT:
            # If the pid file doesn't exist, ignore and continue on since
            # we are already in the desired end state; This should not happen
            pass
        else:
            raise


def _get_pid_file() -> str:
    return os.path.join(config.get_pids_path(), "%d" % os.getpid())


if __name__ == "__main__":
    primary_dataset_name: str
    reference_dataset_name: Optional[str]
    trace_dataset_name: Optional[str] = None

    primary_dataset: Dataset = EMPTY_DATASET
    reference_dataset: Optional[Dataset] = None
    corpus_dataset: Optional[Dataset] = None

    # automatically remove the pid file when the process is being gracefully terminated
    atexit.register(_remove_pid_file)
    _write_pid_file()

    parser = ArgumentParser()
    parser.add_argument("--export_path")
    parser.add_argument("--port", type=int, default=config.PORT)
    parser.add_argument("--no-internet", action="store_true")
    parser.add_argument("--debug", action="store_false")  # TODO: Disable before public launch
    subparsers = parser.add_subparsers(dest="command", required=True)
    datasets_parser = subparsers.add_parser("datasets")
    datasets_parser.add_argument("--primary", type=str, required=True)
    datasets_parser.add_argument("--reference", type=str, required=False)
    datasets_parser.add_argument("--corpus", type=str, required=False)
    fixture_parser = subparsers.add_parser("fixture")
    fixture_parser.add_argument("fixture", type=str, choices=[fixture.name for fixture in FIXTURES])
    fixture_parser.add_argument("--primary-only", type=bool)
    trace_fixture_parser = subparsers.add_parser("trace-fixture")
    trace_fixture_parser.add_argument(
        "fixture", type=str, choices=[fixture.name for fixture in TRACES_FIXTURES]
    )
    args = parser.parse_args()
    export_path = Path(args.export_path) if args.export_path else config.EXPORT_DIR
    if args.command == "datasets":
        primary_dataset_name = args.primary
        reference_dataset_name = args.reference
        corpus_dataset_name = args.corpus
        primary_dataset = Dataset.from_name(primary_dataset_name)
        reference_dataset = (
            Dataset.from_name(reference_dataset_name)
            if reference_dataset_name is not None
            else None
        )
        corpus_dataset = (
            None if corpus_dataset_name is None else Dataset.from_name(corpus_dataset_name)
        )
    elif args.command == "fixture":
        fixture_name = args.fixture
        primary_only = args.primary_only
        primary_dataset, reference_dataset, corpus_dataset = get_datasets(
            fixture_name,
            args.no_internet,
        )
        if primary_only:
            reference_dataset_name = None
            reference_dataset = None
    elif args.command == "trace-fixture":
        trace_dataset_name = args.fixture

    model = create_model_from_datasets(
        primary_dataset,
        reference_dataset,
    )
    traces: Optional[Traces] = None
    if trace_dataset_name is not None:
        traces_ds = load_example_traces(trace_dataset_name)
        traces = Traces(traces_ds.dataframe)
    app = create_app(
        export_path=export_path,
        model=model,
        traces=traces,
        corpus=None if corpus_dataset is None else create_model_from_datasets(corpus_dataset),
        debug=args.debug,
    )

    uvicorn.run(app, port=args.port)
