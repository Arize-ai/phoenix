import argparse
import logging
import os
import uvicorn
import atexit
import errno
import phoenix.config as config
from phoenix.server import create_app, get_pids_path

logger = logging.getLogger(__name__)


def _write_pid_file():
    with open(_get_pid_file(), "w") as outfile:
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
    return os.path.join(get_pids_path(), "%d" % os.getpid())


if __name__ == "__main__":
    # automatically remove the pid file when the process is being gracefully terminated
    atexit.register(_remove_pid_file)
    _write_pid_file()

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=config.port)
    parser.add_argument("--primary", type=str)
    parser.add_argument("--reference", type=str)
    args = parser.parse_args()

    # Validate the required args
    if args.primary is None:
        raise ValueError("Primary dataset is required via the --primary flag")
    if args.reference is None:
        raise ValueError("Reference dataset is required via the --reference flag")
    print(
        f"""Starting Phoenix App
            primary dataset: {args.primary}
            reference dataset: {args.reference}"""
    )

    app = create_app(
        primary_dataset_name=args.primary,
        reference_dataset_name=args.reference,
        debug=config.debug,
        graphiql=config.graphiql,
    )

    uvicorn.run(app, port=args.port)

