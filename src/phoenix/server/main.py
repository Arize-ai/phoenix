import atexit
import errno
import logging
import os
from argparse import ArgumentParser, Namespace
from typing import Optional, Tuple

import uvicorn

import phoenix.config as config
from phoenix.server.app import create_app
from phoenix.server.fixtures import (
    FIXTURES,
    download_fixture_if_missing,
    get_dataset_names_from_fixture_name,
)

logger = logging.getLogger(__name__)


def _validate_arguments(
    arguments: Namespace,
) -> None:
    """
    Validates command line arguments.

    Primary and reference datasets can be specified either explicitly by naming
    existing datasets (in which case no fixture should be provided) or
    implicitly by passing the name of a fixture (in which case no datasets
    should be provided).
    """

    provided_primary_and_reference_flags_only = (
        isinstance(arguments.primary, str)
        and isinstance(arguments.reference, str)
        and arguments.fixture is None
    )
    provided_fixture_flag_only = (
        arguments.primary is None
        and arguments.reference is None
        and isinstance(arguments.fixture, str)
    )
    if not (provided_primary_and_reference_flags_only or provided_fixture_flag_only):
        raise ValueError(
            'Primary and reference datasets can be specified either explicitly via the "--primary" '
            'and "--reference" flags (in which case the "--fixture" flag should be omitted) or '
            'implicitly via the "--fixture" flag (in which case the "--primary" and "--reference" '
            "flags should be omitted)."
        )


def _get_dataset_and_fixture_names(args: Namespace) -> Tuple[str, str, Optional[str]]:
    """
    Gets primary dataset name, reference dataset name, and fixture name from
    command line arguments. In the case where the fixture name is provided,
    primary and reference dataset names will be inferred.
    """
    primary_dataset_name: str
    reference_dataset_name: str
    fixture_name: Optional[str]
    if args.fixture is not None:
        primary_dataset_name, reference_dataset_name = get_dataset_names_from_fixture_name(
            args.fixture
        )
        fixture_name = args.fixture
    else:
        primary_dataset_name = args.primary
        reference_dataset_name = args.reference
    return primary_dataset_name, reference_dataset_name, fixture_name


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
    # automatically remove the pid file when the process is being gracefully terminated
    atexit.register(_remove_pid_file)
    _write_pid_file()

    parser = ArgumentParser()
    parser.add_argument("--primary", type=str)
    parser.add_argument("--reference", type=str)
    parser.add_argument("--fixture", type=str, choices=[fixture.name for fixture in FIXTURES])
    parser.add_argument("--port", type=int, default=config.port)
    parser.add_argument("--graphiql", action="store_true")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    _validate_arguments(args)
    primary_dataset_name, reference_dataset_name, fixture_name = _get_dataset_and_fixture_names(
        args
    )
    if fixture_name is not None:
        download_fixture_if_missing(fixture_name)

    print(
        f"""Starting Phoenix App
            primary dataset: {primary_dataset_name}
            reference dataset: {reference_dataset_name}"""
    )

    app = create_app(
        primary_dataset_name=primary_dataset_name,
        reference_dataset_name=reference_dataset_name,
        debug=args.debug,
        graphiql=args.graphiql,
    )

    uvicorn.run(app, port=args.port)
