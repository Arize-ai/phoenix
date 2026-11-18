"""Base class shared by chat and decision model clients."""

from __future__ import annotations

import importlib.util
from abc import ABC, abstractmethod
from typing import Generic, Hashable, Optional, TypeVar

from phoenix.db.types.model_provider import ClientFactory

ClientT = TypeVar("ClientT")


class Dependency:
    """Set ``module_name`` to the import name if it differs from the package install name."""

    def __init__(self, name: str, module_name: Optional[str] = None):
        self.name = name
        self.module_name = module_name

    @property
    def import_name(self) -> str:
        return self.module_name or self.name


class ModelClient(ABC, Generic[ClientT]):
    provider: str
    _client_factory: ClientFactory[ClientT]

    def __init__(
        self,
        *,
        client_factory: ClientFactory[ClientT],
        model_name: str,
        provider: Optional[str] = None,
    ) -> None:
        self._client_factory = client_factory
        self.model_name = model_name
        if provider:
            self.provider = provider

    @classmethod
    @abstractmethod
    def dependencies(cls) -> list[Dependency]: ...

    @classmethod
    def dependencies_are_installed(cls) -> bool:
        try:
            for dependency in cls.dependencies():
                if importlib.util.find_spec(dependency.import_name) is None:
                    return False
            return True
        except (ImportError, ValueError):
            # find_spec raises ValueError in some cases when the spec is None
            return False

    def get_rate_limit_key(self) -> Hashable:
        return self._client_factory.rate_limit_key

    @abstractmethod
    def is_rate_limit_error(self, e: Exception) -> bool: ...

    @abstractmethod
    def is_transient_error(self, e: Exception) -> bool:
        """Whether ``e`` is a timeout, connection error, or HTTP 5xx worth retrying."""
        ...
