import atexit
import errno
import logging
import os
from argparse import ArgumentParser
from pathlib import Path
from typing import Optional

import uvicorn

import phoenix.config as config
from phoenix.datasets.fixtures import (
    FIXTURES,
    download_fixture_if_missing,
)
from phoenix.server.app import create_app

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
    # automatically remove the pid file when the process is being gracefully terminated
    atexit.register(_remove_pid_file)
    _write_pid_file()

    parser = ArgumentParser()
    parser.add_argument("--export_path")
    parser.add_argument("--port", type=int, default=config.PORT)
    parser.add_argument("--debug", action="store_false")  # TODO: Disable before public launch
    subparsers = parser.add_subparsers(dest="command", required=True)
    fixture_parser = subparsers.add_parser("fixture")
    fixture_parser.add_argument("fixture", type=str, choices=[fixture.name for fixture in FIXTURES])
    args = parser.parse_args()
    export_path = Path(args.export_path) if args.export_path else config.EXPORT_DIR
    primary_dataset, reference_dataset = download_fixture_if_missing(args.fixture)

    app = create_app(
        export_path=export_path,
        primary_dataset=primary_dataset,
        reference_dataset=reference_dataset,
        debug=args.debug,
    )

    uvicorn.run(app, port=args.port)
