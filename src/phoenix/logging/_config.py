from logging import DEBUG, StreamHandler, getLogger
from sys import stdout

from phoenix.config import LoggingMode

from ._formatters import StructuredJSONFormatter


def configure_logging(logging_mode: LoggingMode) -> None:
    """
    Configures logging for the specified logging mode.
    """
    if logging_mode is LoggingMode.DEFAULT:
        _configure_default_logging()
    elif logging_mode is LoggingMode.STRUCTURED:
        _configure_structured_logging()
    else:
        raise ValueError(f"Unsupported logging mode: {logging_mode}")


def _configure_structured_logging() -> None:
    """
    Configures structured logging.
    """
    root_logger = getLogger()
    root_logger.setLevel(DEBUG)
    handler = StreamHandler(stdout)
    handler.setFormatter(StructuredJSONFormatter())
    root_logger.addHandler(handler)


def _configure_default_logging() -> None:
    """
    Configures default logging.
    """
    _configure_default_uvicorn_logging()
    _configure_default_sqlalchemy_logging()
    _configure_default_alembic_logging()


def _configure_default_uvicorn_logging() -> None:
    """
    Configures default logging for uvicorn.
    """


def _configure_default_sqlalchemy_logging() -> None:
    """
    Configures default logging for SQLAlchemy.
    """


def _configure_default_alembic_logging() -> None:
    """
    Configures default logging for Alembic.
    """
