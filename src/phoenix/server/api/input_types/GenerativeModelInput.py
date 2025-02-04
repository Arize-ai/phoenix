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
