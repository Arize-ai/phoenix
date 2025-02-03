from typing import Optional

import strawberry
from strawberry import UNSET

from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


@strawberry.input
class GenerativeModelInput:
    provider_key: GenerativeProviderKey
    name: str
    """ The name of the model. Or the Deployment Name for Azure OpenAI models. """
    base_url: Optional[str] = UNSET
    """ The base URL to use for the model. """
    endpoint: Optional[str] = UNSET
    """ The endpoint to use for the model. Only required for Azure OpenAI models. """
    api_version: Optional[str] = UNSET
    """ The API version to use for the model. """

    def __post_init__(self) -> None:
        if self.base_url and self.endpoint:
            raise ValueError("Must not provide both a base URL and an endpoint at the same time.")
