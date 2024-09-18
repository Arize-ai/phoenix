import logging


class NonErrorFilter(logging.Filter):
    # @override
    def filter(self, record: logging.LogRecord) -> bool | logging.LogRecord:
        return record.levelno <= logging.INFO
