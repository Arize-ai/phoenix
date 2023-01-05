from dataclasses import dataclass
from typing import Optional, Union

from starlette.requests import Request
from starlette.responses import Response
from starlette.websockets import WebSocket

from phoenix.core.model import Model

from .loader import Loader


@dataclass
class Context:
    request: Union[Request, WebSocket]
    response: Optional[Response]
    model: Model
    loaders: Loader
