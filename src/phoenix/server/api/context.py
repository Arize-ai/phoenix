from dataclasses import dataclass
from pathlib import Path
from typing import AsyncContextManager, Callable, Optional, Union

from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import Response
from starlette.websockets import WebSocket

from phoenix.core.model_schema import Model
from phoenix.core.traces import Traces


@dataclass
class Context:
    request: Union[Request, WebSocket]
    response: Optional[Response]
    db: Callable[[], AsyncContextManager[AsyncSession]]
    model: Model
    export_path: Path
    corpus: Optional[Model] = None
    traces: Optional[Traces] = None
