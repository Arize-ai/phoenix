import io
import sys
from contextlib import contextmanager
from typing import Any, Dict, List, Optional
from unittest.mock import patch

import httpx
from gcsfs import GCSFileSystem
from llama_index import (
    ServiceContext,
    StorageContext,
    load_index_from_storage,
)
from llama_index.callbacks import CallbackManager
from llama_index.callbacks.base_handler import BaseCallbackHandler
from llama_index.callbacks.schema import CBEventType
from llama_index.embeddings import OpenAIEmbedding
from llama_index.graph_stores.simple import SimpleGraphStore
from llama_index.llms import (
    OpenAI,
)
from openai import RateLimitError


class ReproCallbackHandler(BaseCallbackHandler):
    def __init__(
        self,
    ) -> None:
        super().__init__(
            event_starts_to_ignore=[],
            event_ends_to_ignore=[],
        )
        self._event_type = {}

    def on_event_start(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        parent_id: str = "",
        **kwargs: Any,
    ) -> str:
        self._event_type[event_id] = event_type

    def on_event_end(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        **kwargs: Any,
    ) -> None:
        ...

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        ...

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        print_trace_map(trace_map, self._event_type, "root")


def print_trace_map(trace_map, event_data, node, prefix=""):
    child_ids = trace_map.get(node, [])
    for child_index, child_id in enumerate(child_ids):
        child_event_type = event_data[child_id]
        if child_index < len(child_ids) - 1:
            print(prefix + "├── " + child_event_type)
            print_trace_map(trace_map, event_data, child_id, prefix + "│   ")
        else:
            print(prefix + "└── " + child_event_type)
            print_trace_map(trace_map, event_data, child_id, prefix + "    ")


@contextmanager
def suppress_stderr():
    original_stderr = sys.stderr
    sys.stderr = io.StringIO()
    try:
        yield
    finally:
        sys.stderr = original_stderr


file_system = GCSFileSystem(project="public-assets-275721")
index_path = "arize-assets/phoenix/datasets/unstructured/llm/llama-index/arize-docs/index/"
with suppress_stderr():  # suppress unrelated warnings
    storage_context = StorageContext.from_defaults(
        fs=file_system,
        persist_dir=index_path,
        graph_store=SimpleGraphStore(),  # prevents unauthorized request to GCS
    )
llm = OpenAI(model="gpt-3.5-turbo", temperature=0.0)
service_context = ServiceContext.from_defaults(
    llm=llm,
    embed_model=OpenAIEmbedding(model="text-embedding-ada-002"),
    callback_manager=CallbackManager(handlers=[ReproCallbackHandler()]),
)
index = load_index_from_storage(
    storage_context,
    service_context=service_context,
)
query_engine = index.as_query_engine()
with patch.object(llm._client.chat.completions, "create") as mocked_chat_completion_create:
    mocked_chat_completion_create.side_effect = RateLimitError(
        "message",
        response=httpx.Response(
            429, request=httpx.Request(method="post", url="https://api.openai.com/")
        ),
        body={},
    )
    try:
        response = query_engine.query("What is Arize and how can it help me as an AI Engineer?")
    except RateLimitError:
        pass
