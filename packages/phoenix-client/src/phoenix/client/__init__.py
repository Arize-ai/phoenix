from importlib.metadata import version

from .client import AsyncClient, Client

__version__ = version("arize-phoenix-client")

__all__ = [
    "AsyncClient",
    "Client",
]
