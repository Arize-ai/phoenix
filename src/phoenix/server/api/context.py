from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Hashable, Optional, Union

from starlette.requests import Request
from starlette.responses import Response
from starlette.websockets import WebSocket

from phoenix.core.model_schema import Model
from phoenix.server.api.pipeline import ModelPlumberWithCache


@dataclass
class Context:
    request: Union[Request, WebSocket]
    response: Optional[Response]
    model: Model
    export_path: Path
    plumbers: Dict[
        Hashable,
        ModelPlumberWithCache[Any, Any],
    ]
