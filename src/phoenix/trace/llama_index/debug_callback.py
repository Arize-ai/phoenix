import logging
from typing import Any, Dict, List, Optional

from llama_index.callbacks.base_handler import BaseCallbackHandler
from llama_index.callbacks.schema import CBEventType

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

CBEventID = str


class LlamaIndexDebugHandler(BaseCallbackHandler):
    def _print_event(self, payload: dict[Any, Any]) -> None:
        for k, v in payload.items():
            print(f"**{k}: **\n{v}")
            print("*" * 50)

    def __init__(self) -> None:
        super().__init__(event_starts_to_ignore=[], event_ends_to_ignore=[])

    def on_event_start(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: CBEventID = "",
        **kwargs: Any,
    ) -> CBEventID:
        return event_id

    def on_event_end(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: CBEventID = "",
        **kwargs: Any,
    ) -> None:
        if payload is not None:
            self._print_event(payload)

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        return

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        return
