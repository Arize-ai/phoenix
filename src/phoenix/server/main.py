import atexit
import errno
import logging
import os
from argparse import ArgumentParser, Namespace
from copy import deepcopy
from typing import Optional

import uvicorn

import phoenix.config as config
from phoenix.server.app import create_app
from phoenix.server.fixtures import (
    FIXTURES,
    download_fixture_if_missing,
    get_dataset_names_from_fixture_name,
)

logger = logging.getLogger(__name__)


def _parse_and_validate_arguments(
    arguments: Namespace,
) -> Namespace:
    """
    Parses and validates command line arguments.

    Primary and reference datasets can be specified either explicitly by naming
    existing datasets or implicitly by passing the name of a fixture. In the
    case where the user provides a fixture name, primary and reference dataset
    names will be inferred. Returns a copy of the input arguments, possibly with
    updated primary and reference fields.
    """

    primary_dataset_name: str
    reference_dataset_name: str
    fixture_name: Optional[str] = None
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
    if provided_primary_and_reference_flags_only:
        primary_dataset_name = arguments.primary
        reference_dataset_name = arguments.reference
    elif provided_fixture_flag_only:
        fixture_name = args.fixture
        primary_dataset_name, reference_dataset_name = get_dataset_names_from_fixture_name(
            args.fixture
        )
    else:
        raise ValueError(
            'Primary and reference datasets can be specified either explicitly via the "--primary" '
            'and "--reference" flags (in which case the "--fixture" flag should be omitted) or '
            'implicitly via the "--fixture" flag (in which case the "--primary" and "--reference" '
            "flags should be omitted)."
        )
    parsed_arguments = deepcopy(arguments)
    parsed_arguments.primary = primary_dataset_name
    parsed_arguments.reference = reference_dataset_name
    parsed_arguments.fixture = fixture_name
    return parsed_arguments


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

    args = _parse_and_validate_arguments(args)
    if args.fixture is not None:
        download_fixture_if_missing(args.fixture)

    print(
        f"""Starting Phoenix App
            primary dataset: {args.primary}
            reference dataset: {args.reference}"""
    )

    app = create_app(
        primary_dataset_name=args.primary,
        reference_dataset_name=args.reference,
        debug=args.debug,
        graphiql=args.graphiql,
    )

    uvicorn.run(app, port=args.port)
