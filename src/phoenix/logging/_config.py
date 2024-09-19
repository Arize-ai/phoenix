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
        _setup_library_logging()
    elif logging_mode is LoggingMode.STRUCTURED:
        _setup_application_logging()
    else:
        assert_never(logging_mode)


def _setup_library_logging() -> None:
    """
    Configures logging if Phoenix is used as a library
    """
    logger = logging.getLogger("phoenix")
    logger.setLevel(Settings.logging_level)
    db_logger = logging.getLogger("sqlalchemy")
    db_logger.setLevel(Settings.db_logging_level)
    logger.info("Default logging ready")


def _setup_application_logging() -> None:
    """
    Configures logging if Phoenix is used as an application
    """
    sql_engine_logger = logging.getLogger("sqlalchemy.engine.Engine")
    # Remove all existing handlers
    for handler in sql_engine_logger.handlers[:]:
        sql_engine_logger.removeHandler(handler)
        handler.close()

    phoenix_logger = logging.getLogger("phoenix")
    phoenix_logger.setLevel(Settings.logging_level)
    phoenix_logger.propagate = False  # Do not pass records to the root logger
    sql_logger = logging.getLogger("sqlalchemy")
    sql_logger.setLevel(Settings.db_logging_level)
    sql_logger.propagate = False  # Do not pass records to the root logger

    log_queue = queue.Queue()  # type:ignore
    queue_handler = logging.handlers.QueueHandler(log_queue)
    phoenix_logger.addHandler(queue_handler)
    sql_logger.addHandler(queue_handler)

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

    # stdout handler
    stdout_handler = logging.StreamHandler(stdout)
    stdout_handler.setFormatter(formatter)
    stdout_handler.setLevel(Settings.logging_level)
    stdout_handler.addFilter(NonErrorFilter())

    # stderr handler
    stderr_handler = logging.StreamHandler(stderr)
    stderr_handler.setFormatter(formatter)
    stderr_handler.setLevel(logging.WARNING)

    queue_listener = logging.handlers.QueueListener(log_queue, stdout_handler, stderr_handler)
    if queue_listener is not None:
        queue_listener.start()
        atexit.register(queue_listener.stop)
    phoenix_logger.info("Structured logging ready")
