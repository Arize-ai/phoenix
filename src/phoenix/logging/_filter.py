import logging


class NonErrorFilter(logging.Filter):
    # @override
    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno <= logging.INFO
