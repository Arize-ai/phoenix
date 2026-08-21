# Trace scenario recorder

These scripts record deterministic scenario traffic through real OpenInference instrumenters. The
result is checked-in OTLP protobuf JSON that can be replayed without installing the scenario
frameworks at runtime.

From the repository root, start the keyless mock provider:

```console
python scripts/datagen/mock_openai_provider.py
```

In another shell, record both scenarios with their isolated PEP 723 environments:

```console
OPENAI_API_KEY=datagen-dummy-key \
  OPENAI_BASE_URL=http://127.0.0.1:8765/v1 \
  uv run scripts/datagen/openai_chat_sessions.py
OPENAI_API_KEY=datagen-dummy-key \
  OPENAI_BASE_URL=http://127.0.0.1:8765/v1 \
  uv run scripts/datagen/langchain_agent_rag.py
```

Each script replaces its scenario's `traces.jsonl` and `manifest.json`. Every JSONL line is one
protobuf-JSON `ExportTraceServiceRequest`; requests from a multi-span trace may occupy multiple
lines. The mock provider never contacts an external service.

Re-record and review the scenario assets whenever a pinned instrumenter version changes. This
version-bump workflow is the freshness mechanism for keeping stored span shapes aligned with
upstream instrumentation.
