import atexit
import logging
import logging.config
import logging.handlers
import queue
from sys import stderr, stdout

from typing_extensions import assert_never

from phoenix.config import LoggingMode
from phoenix.logging._filter import NonErrorFilter
from phoenix.settings import Settings

from ._formatter import PhoenixJSONFormatter


def setup_logging() -> None:
    """
    Configures logging for the specified logging mode.
    """
    logging_mode = Settings.logging_mode
    if logging_mode is LoggingMode.DEFAULT:
        _set_up_default_logging()
    elif logging_mode is LoggingMode.STRUCTURED:
        _set_up_structured_logging()
    else:
        assert_never(logging_mode)


def _set_up_default_logging() -> None:
    logger = logging.getLogger("phoenix")
    logger.setLevel(Settings.logging_level)
    db_logger = logging.getLogger("sqlalchemy")
    db_logger.setLevel(Settings.db_logging_level)
    logger.info("Default logging ready")


def _set_up_structured_logging() -> None:
    logging.getLogger("phoenix").setLevel(Settings.logging_level)
    logging.getLogger("sqlalchemy").setLevel(Settings.db_logging_level)
    root_logger = logging.getLogger()
    root_logger.setLevel(Settings.logging_level)

    fmt_keys = {
        "level": "levelname",
        "message": "message",
        "timestamp": "timestamp",
        "logger": "name",
        "module": "module",
        "function": "funcName",
        "line": "lineno",
        "thread_name": "threadName",
    }
    formatter = PhoenixJSONFormatter(fmt_keys=fmt_keys)

    stdout_handler = logging.StreamHandler(stdout)
    stdout_handler.setFormatter(formatter)
    stdout_handler.addFilter(NonErrorFilter())

    stderr_handler = logging.StreamHandler(stderr)
    stderr_handler.setFormatter(formatter)
    stderr_handler.setLevel(logging.WARNING)

    log_queue = queue.Queue()  # type:ignore
    root_logger.addHandler(logging.handlers.QueueHandler(log_queue))
    queue_listener = logging.handlers.QueueListener(
        log_queue, stdout_handler, stderr_handler, respect_handler_level=True
    )
    queue_listener.start()
    atexit.register(queue_listener.stop)
    logging.getLogger("phoenix").info("Structured logging ready")
