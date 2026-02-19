---
name: phoenix-python-client
description: Add or modify methods in the Phoenix Python client SDK. Use when implementing new SDK methods, adding parameters to existing client methods, updating the Python client to match REST API changes, or regenerating generated types from the OpenAPI schema. Triggers on tasks involving packages/phoenix-client, Python client methods, or generated Python types.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: Python
  internal: true
---

# Phoenix Python Client

The Phoenix Python client (`arize-phoenix-client`) is a lightweight SDK that wraps the Phoenix REST API. Resource methods live under `packages/phoenix-client/src/phoenix/client/resources/`. Typed dataclasses are **generated** from `schemas/openapi.json` and must be regenerated whenever the REST API schema changes.

## Key Locations

| Item | Path |
|---|---|
| Resource implementations | `packages/phoenix-client/src/phoenix/client/resources/` |
| Generated types | `packages/phoenix-client/src/phoenix/client/__generated__/v1/` |
| Type generation command | `tox run -e openapi_codegen_for_python_client` |
| Integration tests | `tests/integration/client/` |

## Workflow

### Adding or changing a client method

1. **Ensure `schemas/openapi.json` is up to date** — if the REST API changed, rebuild it first:
   ```bash
   tox run -e build_openapi_schema
   ```

2. **Regenerate the Python types** from the schema:
   ```bash
   tox run -e openapi_codegen_for_python_client
   ```
   This updates `packages/phoenix-client/src/phoenix/client/__generated__/v1/__init__.py`. Commit the regenerated file.

3. **Update both sync and async implementations** — each resource has a synchronous class and an async counterpart. Both must be updated together:

   ```python
   class Experiments:  # sync client
       def delete(self, *, experiment_id: str, new_param: bool = False) -> None:
           response = self._client.delete(
               f"/v1/experiments/{experiment_id}",
               params={"new_param": new_param},
           )
           ...

   class AsyncExperiments:  # async client
       async def delete(self, *, experiment_id: str, new_param: bool = False) -> None:
           response = await self._client.delete(
               f"/v1/experiments/{experiment_id}",
               params={"new_param": new_param},
           )
           ...
   ```

4. **Add an integration test** in `tests/integration/client/test_<resource>.py`. Integration tests spin up a real Phoenix server and exercise the full stack — prefer them over mocked unit tests for client methods:

   ```bash
   uv run pytest tests/integration/client/test_experiments.py -v
   ```

## Testing

```bash
# Run all client integration tests
uv run pytest tests/integration/client/ -n auto

# Run a specific test file
uv run pytest tests/integration/client/test_experiments.py -v
```

## Non-Obvious Notes

- **Generated types are checked in**: `packages/phoenix-client/src/phoenix/client/__generated__/v1/__init__.py` is committed. After schema changes, always regenerate and commit. The codegen uses `datamodel-code-generator` with specific flags — do not hand-edit the generated file.
- **Schema must be fresh first**: `openapi_codegen_for_python_client` reads from `schemas/openapi.json`. If you run it before rebuilding the schema, the generated types will be stale.
- **Sync and async parity**: Every public method in the sync client must have an equivalent in the async client. They typically share the same signature; the only difference is `async def` and `await`.
- **Use keyword-only arguments**: Client method parameters should be keyword-only (after `*`) to allow future additions without breaking callers.
- **Params dict for query parameters**: Pass query parameters as a `params={}` dict to the httpx client rather than interpolating them into the URL.
- **Integration tests cover both sync and async**: The integration test suite runs both client variants. Structure tests to exercise both where applicable.
