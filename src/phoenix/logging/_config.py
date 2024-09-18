import atexit
import logging
import logging.config
import logging.handlers
import queue
from sys import stderr, stdout

# from typing import override
from phoenix.config import LoggingMode, get_env_logging_mode
from phoenix.logging._filter import NonErrorFilter
from phoenix.settings import Settings

from ._formatter import PhoenixJSONFormatter


def setup_logging():
    """
    Configures logging for the specified logging mode.
    """
    logging_mode = Settings.logging_mode
    if logging_mode is LoggingMode.AS_LIBRARY:
        _setup_library_logging()
    elif logging_mode is LoggingMode.AS_APPLICATION:
        _setup_application_logging()
    else:
        raise ValueError(f"Unsupported logging mode: {logging_mode}")


def _setup_library_logging():
    """
    Configures logging if Phoenix is used as a library
    """
    logger = logging.getLogger("phoenix")
    logger.setLevel(Settings.logging_level)
    db_logger = logging.getLogger("sqlalchemy")
    db_logger.setLevel(Settings.db_logging_level)
    logger.info("Default logging ready")


def _setup_application_logging():
    """
    Configures logging if Phoenix is used as an application
    """
    root_logger = logging.getLogger()
    # Remove all existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
        handler.close()

    sql_engine_logger = logging.getLogger("sqlalchemy.engine.Engine")
    # Remove all existing handlers
    for handler in sql_engine_logger.handlers[:]:
        sql_engine_logger.removeHandler(handler)
        handler.close()

    phoenix_logger = logging.getLogger("phoenix")
    phoenix_logger.setLevel(Settings.logging_level)
    sql_logger = logging.getLogger("sqlalchemy")
    sql_logger.setLevel(Settings.db_logging_level)

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
    stdout_handler.setLevel(Settings.logging_level)
    stdout_handler.addFilter(NonErrorFilter())
    stderr_handler = logging.StreamHandler(stderr)
    stderr_handler.setFormatter(formatter)
    stderr_handler.setLevel(logging.WARNING)

    log_queue = queue.Queue()
    queue_handler = logging.handlers.QueueHandler(log_queue)
    phoenix_logger.addHandler(queue_handler)
    sql_logger.addHandler(queue_handler)

    queue_listener = logging.handlers.QueueListener(log_queue, stdout_handler, stderr_handler)
    if queue_listener is not None:
        queue_listener.start()
        atexit.register(queue_listener.stop)
    phoenix_logger.info("Structured logging ready")
