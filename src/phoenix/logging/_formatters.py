import json
from datetime import datetime, timezone
from logging import Formatter, LogRecord
from types import MappingProxyType


class StructuredJSONFormatter(Formatter):
    # todo: add override
    def format(self, record: LogRecord) -> str:
        structured_log_message_data = {
            "message": record.getMessage(),
            "utc_iso_timestamp": _to_utc_iso_timestamp(record.created),
            "local_iso_timestamp": _to_local_iso_timestamp(record.created),
        }
        if record.exc_info:
            # The base class caches formatted exception information on
            # individual LogRecord objects so that it does not need to be
            # recomputed by each handler's formatter. We skip this caching since
            # we only attach a single handler to the root logger.
            structured_log_message_data["traceback"] = self.formatException(record.exc_info)
        if record.stack_info:
            structured_log_message_data["stacktrace"] = self.formatStack(record.stack_info)
        for (
            record_attribute_name,
            structured_log_field_name,
        ) in _LOG_RECORD_ATTRIBUTES_TO_STRUCTURED_LOG_FIELDS.items():
            if (record_attribute_value := getattr(record, record_attribute_name, None)) is not None:
                structured_log_message_data[structured_log_field_name] = record_attribute_value
        return json.dumps(structured_log_message_data, default=str)


def _to_utc_iso_timestamp(unix_timestamp: float) -> str:
    """
    Converts a Unix timestamp to an ISO 8601 formatted UTC timestamp.
    """
    return datetime.fromtimestamp(unix_timestamp, timezone.utc).isoformat()


def _to_local_iso_timestamp(unix_timestamp: float) -> str:
    """
    Converts a Unix timestamp to an ISO 8601 formatted local timestamp.
    """
    return datetime.fromtimestamp(unix_timestamp, timezone.utc).astimezone().isoformat()


_LOG_RECORD_ATTRIBUTES_TO_STRUCTURED_LOG_FIELDS = MappingProxyType(
    {
        "name": "logger_name",
        "levelno": "log_level_number",
        "levelname": "log_level_name",
        "pathname": "path_name",
        "filename": "file_name",
        "module": "module",
        "lineno": "line_number",
        "thread": "thread_id",
        "threadName": "thread_name",
        "taskName": "task_name",
        "process": "process_id",
    }
)
