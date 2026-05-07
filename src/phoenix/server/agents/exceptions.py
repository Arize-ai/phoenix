"""Domain exceptions for the agents package.

These are transport-neutral. The REST router maps them to HTTP responses
via the ``status_code`` carried on each subclass; tests can match on the
exception types directly without depending on FastAPI.
"""

from phoenix.exceptions import PhoenixException


class AgentError(PhoenixException):
    """Base class for agent-domain errors."""

    status_code: int = 400


class ProviderNotFoundError(AgentError):
    """Custom provider record does not exist."""

    status_code: int = 404


class ProviderConfigError(AgentError):
    """Custom provider config could not be decrypted or parsed, or a stored
    secret could not be decrypted."""


class ProviderCredentialsError(AgentError):
    """Required credentials for the selected provider are missing."""


class ProviderUnsupportedError(AgentError):
    """Provider type is not supported."""


class ProviderDependencyError(AgentError):
    """A required SDK package (e.g. ``azure-identity``) is not installed."""


class SummarizationError(AgentError):
    """Raised when the model does not produce a usable summary tool call."""
