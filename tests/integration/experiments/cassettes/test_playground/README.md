# Playground integration test cassettes

This directory is reserved for HTTP recordings (VCR cassettes or equivalent
fixtures) that back the parametrize cases in
`tests/integration/experiments/test_playground.py` which depend on services
the in-process mock LLM server does not implement.

## Currently pending: `vertex_gemini`

The `vertex_gemini` parametrize case under
`TestChatCompletionOverDataset.test_provider_without_evaluators` is marked
`pytest.mark.skip` until a cassette is recorded against a live GCP project.

The Vertex AI builtin provider runs inside the Phoenix server subprocess and:

1. Calls `google.auth.default()` to obtain Application Default Credentials
2. Reads `GOOGLE_CLOUD_PROJECT` (env var, secret store, or ADC default project)
3. Constructs `google.genai.client.Client(vertexai=True, ...)` and streams
   responses from a real Vertex AI endpoint

The existing integration harness sets up *custom providers* pointing at the
in-process mock LLM server. There is no way to retarget the Vertex builtin
client at the mock from a test process, and `google.auth.default()` will raise
`DefaultCredentialsError` in CI. A recorded cassette (or equivalent live-creds
harness) is therefore required to exercise the full subscription pipeline.

## Recording procedure

1. Authenticate ADC locally:

   ```sh
   gcloud auth application-default login
   ```

2. Export the project and (optionally) the location used by the test:

   ```sh
   export GOOGLE_CLOUD_PROJECT=<your-gcp-project>
   export GOOGLE_CLOUD_LOCATION=us-central1
   ```

3. Re-enable the parametrize case in `test_playground.py` by removing the
   `marks=pytest.mark.skip(...)` argument from the `vertex_gemini` entry.

4. Add VCR (or `pytest-recording`) plumbing to the test. The Vertex AI client
   uses `google-genai` which talks HTTP/2 to `*.googleapis.com`. Configure the
   recorder to filter credentials and bearer tokens out of headers before
   committing the cassette. Suggested filter list:

   - `Authorization`
   - `x-goog-api-key`
   - `x-goog-user-project`

5. Run the test with recording enabled and confirm the cassette is written
   under this directory:

   ```sh
   uv run pytest tests/integration/experiments/test_playground.py \
       -k vertex_gemini --record-mode=once
   ```

6. Inspect the resulting YAML, scrub any project IDs you do not want to leak,
   and commit the cassette.

## Assertion target

When the case is enabled it must verify that at least one span recorded for
the experiment has `llm.provider == "vertex_ai"` (the value emitted by
`VertexAIGemini20StreamingClient` / `Gemini25` / `Gemini3` in
`src/phoenix/server/api/helpers/playground_clients.py`). Reuse the span and
trace assertions already present in `test_provider_without_evaluators`; the
additional check should look up the span's `llm.provider` attribute via the
GraphQL `Span.attributes` field (extend `GET_EXPERIMENT` if necessary).
