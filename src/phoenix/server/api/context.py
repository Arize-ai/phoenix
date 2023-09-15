from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union

from starlette.requests import Request
from starlette.responses import Response
from starlette.websockets import WebSocket

from phoenix.core.model_schema import Model
from phoenix.core.traces import Traces
from phoenix.pointcloud.umap_parameters import UMAPParameters


@dataclass
class Context:
    request: Union[Request, WebSocket]
    response: Optional[Response]
    model: Model
    export_path: Path
    corpus: Optional[Model] = None
    traces: Optional[Traces] = None
    umap_parameters: UMAPParameters
