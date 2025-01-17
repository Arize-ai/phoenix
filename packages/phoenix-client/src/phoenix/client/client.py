from typing import Mapping, Optional, Union

import httpx
from httpx import Timeout

from phoenix.client.constants import DEFAULT_MAX_RETRIES
from phoenix.client.resources.prompts import AsyncPrompts, Prompts
from phoenix.client.types import NOT_GIVEN, NotGiven
from phoenix.client.utils.config import get_base_url


class Client:
    def __init__(
        self,
        *,
        base_url: Optional[Union[str, httpx.URL]] = None,
        timeout: Union[float, Timeout, None, NotGiven] = NOT_GIVEN,
        max_retries: int = DEFAULT_MAX_RETRIES,
        default_headers: Optional[Mapping[str, str]] = None,
        default_query: Optional[Mapping[str, object]] = None,
        http_client: Optional[httpx.Client] = None,
    ):
        base_url = base_url or get_base_url()
        http_client = http_client or httpx.Client(
            base_url=base_url,
        )
        self.prompts = Prompts(http_client)


class AsyncClient:
    def __init__(
        self,
        *,
        base_url: Optional[Union[str, httpx.URL]] = None,
        timeout: Union[float, Timeout, None, NotGiven] = NOT_GIVEN,
        max_retries: int = DEFAULT_MAX_RETRIES,
        default_headers: Optional[Mapping[str, str]] = None,
        default_query: Optional[Mapping[str, object]] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        base_url = base_url or get_base_url()
        http_client = http_client or httpx.AsyncClient(
            base_url=base_url,
        )
        self.prompts = AsyncPrompts(http_client)
