# A collection of printing and logging utilities
import atexit
import datetime as dt
import json
import logging
import logging.config
import logging.handlers
import pathlib
import queue
from sys import stderr, stdout

# from typing import override
from phoenix.config import LoggingMode, get_env_logging_mode

CONFIG_FILE = "structured-logging.json"


def setup_logging():
    """
    Configures logging for the specified logging mode.
    """
    logging_mode = get_env_logging_mode()
    logging_mode = LoggingMode.DEFAULT
    if logging_mode is LoggingMode.DEFAULT:
        _setup_default_logging()
    elif logging_mode is LoggingMode.STRUCTURED:
        _setup_structured_logging()
    else:
        raise ValueError(f"Unsupported logging mode: {logging_mode}")


def _setup_default_logging():
    """
    Configures default logging.
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)


def _setup_structured_logging():
    """
    Configures structured logging.
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

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
    formatter = MyJSONFormatter(fmt_keys=fmt_keys)

    stdout_handler = logging.StreamHandler(stdout)
    stdout_handler.setFormatter(formatter)

    log_queue = queue.Queue()
    queue_handler = logging.handlers.QueueHandler(log_queue)
    root_logger.addHandler(queue_handler)

    queue_listener = logging.handlers.QueueListener(log_queue, stdout_handler)
    if queue_listener is not None:
        queue_listener.start()
        # atexit.register(queue_listener.stop)


LOG_RECORD_BUILTIN_ATTRS = {
    "args",
    "asctime",
    "created",
    "exc_info",
    "exc_text",
    "filename",
    "funcName",
    "levelname",
    "levelno",
    "lineno",
    "module",
    "msecs",
    "message",
    "msg",
    "name",
    "pathname",
    "process",
    "processName",
    "relativeCreated",
    "stack_info",
    "thread",
    "threadName",
    "taskName",
}


class MyJSONFormatter(logging.Formatter):
    def __init__(
        self,
        *,
        fmt_keys: dict[str, str] | None = None,
    ):
        super().__init__()
        self.fmt_keys = fmt_keys if fmt_keys is not None else {}

    # @override
    def format(self, record: logging.LogRecord) -> str:
        message = self._prepare_log_dict(record)
        return json.dumps(message, default=str)

    def _prepare_log_dict(self, record: logging.LogRecord):
        always_fields = {
            "message": record.getMessage(),
            "timestamp": dt.datetime.fromtimestamp(record.created, tz=dt.timezone.utc).isoformat(),
        }
        if record.exc_info is not None:
            always_fields["exc_info"] = self.formatException(record.exc_info)

        if record.stack_info is not None:
            always_fields["stack_info"] = self.formatStack(record.stack_info)

        message = {
            key: msg_val
            if (msg_val := always_fields.pop(val, None)) is not None
            else getattr(record, val)
            for key, val in self.fmt_keys.items()
        }
        message.update(always_fields)

        for key, val in record.__dict__.items():
            if key not in LOG_RECORD_BUILTIN_ATTRS:
                message[key] = val

        return message


class NonErrorFilter(logging.Filter):
    # @override
    def filter(self, record: logging.LogRecord) -> bool | logging.LogRecord:
        return record.levelno <= logging.INFO
