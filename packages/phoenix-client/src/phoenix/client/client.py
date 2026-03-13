from __future__ import annotations

import logging
from typing import Any, Mapping, Optional

import httpx
from typing_extensions import override

from phoenix.client.resources.datasets import AsyncDatasets, Datasets
from phoenix.client.resources.experiments import AsyncExperiments, Experiments
from phoenix.client.resources.projects import AsyncProjects, Projects
from phoenix.client.resources.prompts import AsyncPrompts, Prompts
from phoenix.client.resources.sessions import AsyncSessions, Sessions
from phoenix.client.resources.spans import AsyncSpans, Spans
from phoenix.client.resources.traces import AsyncTraces, Traces
from phoenix.client.types.semver import SemanticVersion
from phoenix.client.utils.config import get_base_url, get_env_client_headers
from phoenix.client.utils.semver_utils import parse_semantic_version

logger = logging.getLogger(__name__)

_VERSION_HEADER = "x-phoenix-server-version"


class Client:
    def __init__(
        self,
        *,
        base_url: str | httpx.URL | None = None,
        api_key: str | None = None,
        headers: Mapping[str, str] | None = None,
        http_client: httpx.Client | None = None,
    ):
        """Initializes a Client instance.

        Args:
            base_url (Optional[str | httpx.URL]): The base URL for the API endpoint.
                If not provided, it will be read from the environment variables or
                fall back to http://localhost:6006.
            api_key (Optional[str]): The API key for authentication. If provided, it
                will be included in the Authorization header as a bearer token.
            headers (Optional[Mapping[str, str]]): Additional headers to be included
                in the HTTP requests. This is ignored if http_client is provided.
                Additional headers may be added from the environment variables, but
                won't override specified values.
            http_client (Optional[httpx.Client]): An instance of httpx.Client to be
                used for making HTTP requests. If not provided, a new instance will
                be created.
        """
        if http_client is None:
            base_url = base_url or get_base_url()
            self._client = PhoenixHTTPClient(
                base_url=base_url,
                headers=_update_headers(headers, api_key),
                timeout=httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0),
            )
        else:
            self._client = PhoenixHTTPClient(
                base_url=http_client.base_url, headers=dict(http_client.headers)
            )

    @property
    def _client(self) -> PhoenixHTTPClient:
        return self._http_client

    @_client.setter
    def _client(self, value: PhoenixHTTPClient) -> None:
        self._http_client = value
        self._prompts = Prompts(value)
        self._projects = Projects(value)
        self._spans = Spans(value)
        self._traces = Traces(value)
        self._sessions = Sessions(value, self._spans)
        self._datasets = Datasets(value)
        self._experiments = Experiments(value)

    @property
    def prompts(self) -> Prompts:
        """Returns an instance of the Prompts class for interacting with prompt-related API endpoints.

        Returns:
            Prompts: An instance of the Prompts class.
        """  # noqa: E501
        return self._prompts

    @property
    def projects(self) -> Projects:
        """Returns an instance of the Projects class for interacting with project-related API endpoints.

        Returns:
            Projects: An instance of the Projects class.
        """  # noqa: E501
        return self._projects

    @property
    def spans(self) -> Spans:
        """Returns an instance of the Spans class for interacting with span-related API endpoints.

        Returns:
            Spans: An instance of the Spans class.
        """  # noqa: E501
        return self._spans

    @property
    def traces(self) -> Traces:
        """Returns an instance of the Traces class for interacting with trace-related API endpoints.

        Returns:
            Traces: An instance of the Traces class.
        """  # noqa: E501
        return self._traces

    @property
    def sessions(self) -> Sessions:
        """Returns an instance of the Sessions class for interacting with session-related API endpoints.

        Returns:
            Sessions: An instance of the Sessions class.
        """  # noqa: E501
        return self._sessions

    @property
    def datasets(self) -> Datasets:
        """Returns an instance of the Datasets class for interacting with dataset-related API endpoints.

        Returns:
            Datasets: An instance of the Datasets class.
        """  # noqa: E501
        return self._datasets

    @property
    def experiments(self) -> Experiments:
        """Returns an instance of the Experiments class for interacting with experiment-related API endpoints.

        Returns:
            Experiments: An instance of the Experiments class.
        """  # noqa: E501
        return self._experiments


class AsyncClient:
    def __init__(
        self,
        *,
        base_url: str | httpx.URL | None = None,
        api_key: str | None = None,
        headers: Mapping[str, str] | None = None,
        http_client: httpx.AsyncClient | None = None,
    ):
        """Initializes an Asynchronous Client instance.

        Args:
            base_url (Optional[str | httpx.URL]): The base URL for the API endpoint.
                If not provided, it will be read from the environment variables or
                fall back to http://localhost:6006.
            api_key (Optional[str]): The API key for authentication. If provided, it
                will be included in the Authorization header as a bearer token.
            headers (Optional[Mapping[str, str]]): Additional headers to be included
                in the HTTP requests. This is ignored if http_client is provided.
                Additional headers may be added from the environment variables, but
                won't override specified values.
            http_client (Optional[httpx.AsyncClient]): An instance of httpx.AsyncClient
                to be used for making HTTP requests. If not provided, a new instance
                will be created.
        """
        if http_client is None:
            base_url = base_url or get_base_url()
            self._client = PhoenixAsyncHTTPClient(
                base_url=base_url,
                headers=_update_headers(headers, api_key),
            )
        else:
            self._client = PhoenixAsyncHTTPClient(
                base_url=http_client.base_url, headers=dict(http_client.headers)
            )

    @property
    def _client(self) -> PhoenixAsyncHTTPClient:
        return self._http_client

    @_client.setter
    def _client(self, value: PhoenixAsyncHTTPClient) -> None:
        self._http_client = value
        self._prompts = AsyncPrompts(value)
        self._projects = AsyncProjects(value)
        self._spans = AsyncSpans(value)
        self._traces = AsyncTraces(value)
        self._sessions = AsyncSessions(value, self._spans)
        self._datasets = AsyncDatasets(value)
        self._experiments = AsyncExperiments(value)

    @property
    def prompts(self) -> AsyncPrompts:
        """
        Returns an instance of the AsyncPrompts class for interacting with prompt-related API endpoints.

        Returns:
            AsyncPrompts: An instance of the AsyncPrompts class.
        """  # noqa: E501
        return self._prompts

    @property
    def projects(self) -> AsyncProjects:
        """Returns an instance of the AsyncProjects class for interacting with project-related API endpoints.

        Returns:
            AsyncProjects: An instance of the AsyncProjects class.
        """  # noqa: E501
        return self._projects

    @property
    def spans(self) -> AsyncSpans:
        """Returns an instance of the AsyncSpans class for interacting with span-related API endpoints.

        Returns:
            AsyncSpans: An instance of the AsyncSpans class.
        """  # noqa: E501
        return self._spans

    @property
    def traces(self) -> AsyncTraces:
        """Returns an instance of the AsyncTraces class for interacting with trace-related API endpoints.

        Returns:
            AsyncTraces: An instance of the AsyncTraces class.
        """  # noqa: E501
        return self._traces

    @property
    def sessions(self) -> AsyncSessions:
        """Returns an instance of the AsyncSessions class for interacting with session-related API endpoints.

        Returns:
            AsyncSessions: An instance of the AsyncSessions class.
        """  # noqa: E501
        return self._sessions

    @property
    def datasets(self) -> AsyncDatasets:
        """Returns an instance of the AsyncDatasets class for interacting with dataset-related API endpoints.

        Returns:
            AsyncDatasets: An instance of the AsyncDatasets class.
        """  # noqa: E501
        return self._datasets

    @property
    def experiments(self) -> AsyncExperiments:
        """Returns an instance of the AsyncExperiments class for interacting with experiment-related API endpoints.

        Returns:
            AsyncExperiments: An instance of the AsyncExperiments class.
        """  # noqa: E501
        return self._experiments


def _update_headers(
    headers: Optional[Mapping[str, str]],
    api_key: Optional[str],
) -> dict[str, str]:
    headers = dict(headers or {})
    for k, v in get_env_client_headers().items():
        if k not in headers:
            headers[k] = v
    if api_key:
        headers = {
            **{k: v for k, v in (headers or {}).items() if k.lower() != "authorization"},
            "Authorization": f"Bearer {api_key}",
        }
    return headers


def _extract_version_from_response(response: httpx.Response) -> Optional[SemanticVersion]:
    """Extract and parse the server version from a response header."""
    version_str = response.headers.get(_VERSION_HEADER)
    if version_str:
        return parse_semantic_version(version_str)
    return None


def _fetch_and_parse_version(response: httpx.Response) -> SemanticVersion:
    """Parse the server version from a version-endpoint response, or raise."""
    if response.status_code == 200:
        parsed = parse_semantic_version(response.text)
        if parsed is not None:
            return parsed
    from phoenix.client.exceptions import PhoenixException

    raise PhoenixException(
        "Phoenix server version could not be determined. "
        "Please ensure you are connecting to a supported Phoenix server."
    )


class PhoenixHTTPClient(httpx.Client):
    _server_version: Optional[SemanticVersion]

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]
        self._server_version = None

    def __del__(self) -> None:
        try:
            self.close()
        except BaseException:
            pass

    @override
    def send(self, *args: Any, **kwargs: Any) -> httpx.Response:
        response = super().send(*args, **kwargs)
        if self._server_version is None:
            self._server_version = _extract_version_from_response(response)
        return response

    def fetch_server_version(self) -> None:
        """Eagerly fetch the Phoenix server version if not yet cached.

        Calls ``GET /arize_phoenix_version`` and caches the result.

        Raises:
            PhoenixException: If the server version cannot be determined.
        """
        if self._server_version is not None:
            return
        try:
            response = self.get("arize_phoenix_version")
            self._server_version = _fetch_and_parse_version(response)
        except Exception:
            logger.debug("Failed to fetch Phoenix server version", exc_info=True)
            raise

    @property
    def server_version(self) -> Optional[SemanticVersion]:
        """The cached Phoenix server version, or ``None`` if unknown.

        The version is populated from the ``x-phoenix-server-version``
        response header.  If no response has been seen yet, returns ``None``
        (use :meth:`fetch_server_version` to eagerly fetch).
        """
        return self._server_version

    @server_version.setter
    def server_version(self, value: Optional[SemanticVersion]) -> None:
        """Explicitly set the server version (useful for testing)."""
        self._server_version = value


class PhoenixAsyncHTTPClient(httpx.AsyncClient):
    _server_version: Optional[SemanticVersion]

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]
        self._server_version = None

    @override
    async def send(self, *args: Any, **kwargs: Any) -> httpx.Response:
        response = await super().send(*args, **kwargs)
        if self._server_version is None:
            self._server_version = _extract_version_from_response(response)
        return response

    async def async_fetch_server_version(self) -> None:
        """Eagerly fetch the Phoenix server version if not yet cached.

        Calls ``GET /arize_phoenix_version`` and caches the result.

        Raises:
            PhoenixException: If the server version cannot be determined.
        """
        if self._server_version is not None:
            return
        try:
            response = await self.get("arize_phoenix_version")
            self._server_version = _fetch_and_parse_version(response)
        except Exception:
            logger.debug("Failed to fetch Phoenix server version", exc_info=True)
            raise

    @property
    def server_version(self) -> Optional[SemanticVersion]:
        """The cached Phoenix server version, or ``None`` if unknown."""
        return self._server_version
