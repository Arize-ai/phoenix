# Migrations

## v8.x to v9.0.0

This release migrates all annotations on spans and traces to a structure that supports multiple annotation values per entity (trace, span). This migration also changes the constraints for the tables. Because it operates on existing data, it may take a bit of time for the records to be fully migrated over. Phoenix migrates your data at boot so you may experience some slowness in the server coming up (depending on the amount of data you have). Please deploy v9.0 when your services can account for small amount of downtime.

Phoenix 9.0 also contains project-level retention policies. By default your pre-existing projects will point to a default retention policy of infinite retention so your data will no be affected.

> [!CAUTION]
> This version bump migrates all your annotations to a new format. Do not restart the server while the migration is running. Ensure that the migration is complete. Restarting the server mid-migration could put the DB in a state that will require manual intervention.

## v6.x to v7.0.0

### Python Script to Populate Database Table For Sessions

#### Option I. Run the script via the installed module

This assumes the database up migration has been applied by the Phoenix application, i.e. the new table for sessions has been created. See Option II for how to manually apply the up migration.

> [!NOTE]
> If you are using a PostgreSQL database, you will have to have the postgres extras installed via `pip install arize-phoenix[pg]`.

```shell
python -m phoenix.db.migrations.data_migration_scripts.populate_project_sessions
```

#### Option II. Run the script from the repository (and apply the up migration manually).

Step 1. Clone the Phoenix repository.

```shell
git clone git@github.com:Arize-ai/phoenix.git
```

Step 2. Change directory to where `alembic.ini` is located.

```shell
cd phoenix/src/phoenix/db/
```

Step 3. Run `alembic` for database `up` migration. This creates the new table for sessions.

```shell
alembic upgrade head
```

Step 4. Run script to populate sessions table from spans.

```shell
python migrations/data_migration_scripts/populate_project_sessions.py
```

#### Environment Variables Used by the Script

SQLite example

```shell
export PHOENIX_SQL_DATABASE_URL=sqlite:////phoenix.db
```

PostgreSQL example

```shell
export PHOENIX_SQL_DATABASE_URL=postgresql://localhost:5432/postgres?username=postgres&password=postgres
```

Optionally for PostgreSQL, you can set the schema via the environment variable `PHOENIX_SQL_DATABASE_SCHEMA`.

## v4.x to v5.0.0

Phoenix 5 introduces authentication. By default authentication is disabled and Phoenix will operate exactly as previous versions. Phoenix's authentication is designed to be as flexible as possible and can be adopted incrementally.

With authentication enabled, all API and UI access will be gated with credentials or API keys. Because of this, you will encounter some down time so please plan accordingly.

Phoenix 5 also fully de-couples instrumentation from the Phoenix package. All instrumentation should be installed and run via the OpenInference package. This allows for more flexibility in instrumentation and allows Phoenix to focus on its core functionality.

### Enabling Authentication

To get started, simply set two environment variables for your deployment:

```shell
export PHOENIX_ENABLE_AUTH=True
export PHOENIX_SECRET=a-sufficiently-long-secret
```

Once these environment variables are set, Phoenix scaffold and admin login and the entire server will be protected. Log in as the admin user and create a system key to use with your application(s). All API keys should be added as headers to your requests via the `Authorization` header using the `Bearer` scheme.

For more details, please see the [authentication setup guide](https://docs.arize.com/phoenix/setup/authentication).

### Migrating to OpenInference

If you are using Phoenix's `phoenix.trace` modules for LlamaIndex, LangChain, or OpenAI, you will need to migrate to OpenInference. OpenInference is a separate set of packages that provides instrumentation for Phoenix. Phoenix 5 no longer supports LlamaIndex or LangChain instrumentation from the `phoenix.trace` module.

Phoenix now includes a `phoenix.otel` module that provides simplified setup for OpenTelemetry. See the [`phoenix.otel` documentation](https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing/setup-tracing-python) for more details.

**Before**

```python
from phoenix.trace.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument()
```

**After**

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

For an extensive list of supported instrumentation, please see the [OpenInference](https://github.com/Arize-ai/openinference)

## v3.x to v4.0.0

### Migrating from legacy `phoenix.Dataset` to `phoenix.Inferences`

- `phoenix.Dataset` has been renamed to `phoenix.Inferences`
- `phoenix.ExampleDataset` has been renamed to `phoenix.ExampleInferences`
- All other methods and related functions and classes remain under the `phoenix` namespace

#### Old

```python
from phoenix import Dataset, ExampleDataset
```

#### New

```python
from phoenix import Inferences, ExampleInferences
```

## Migrating from `phoenix.experimental.evals` to `phoenix.evals`

- Phoenix has now moved promoted the `evals` module out of experimental and can be installed as a separate extra.

### Installing and Using the `evals` module

#### Old

```shell
pip install arize-phoenix[experimental]
```

```python
from phoenix.experimental.evals import OpenAIModel
from phoenix.experimental.evals import llm_classify

model = OpenAIModel()

```

#### New

```shell
pip install arize-phoenix[evals]
```

```python
from phoenix.evals import OpenAIModel
from phoenix.evals import llm_classify
```

### Token counting has been removed `evals`

#### Old

```python
from phoenix.experimental.evals import OpenAIModel
from phoenix.experimental.evals import processing # no longer supported in phoenix.evals

model = OpenAIModel()
model.max_context_size  # no longer supported in phoenix.evals
model.get_token_count_from_messages(...)  # no longer supported in phoenix.evals
model.get_tokens_from_text(...)  # no longer supported in phoenix.evals
model.get_text_from_tokens(...)  # no longer supported in phoenix.evals
```

### `BaseEvalModel` has been renamed to `BaseModel`

When implementing a custom model wrapper for use with Phoenix, the base class has been renamed.

#### Old

```python
from phoenix.experimental.evals.models import BaseEvalModel  # renamed to BaseModel
```

#### New

```python
from phoenix.evals.models import BaseModel
```

### Some modules in `phoenix.evals` have been relocated and renamed

#### Old

```python
from phoenix.experimental.evals.functions import classify, generate
from phoenix.experimental.evals.templates import default_templates, template
```

#### New

```python
from phoenix.evals import classify, generate
from phoenix.evals import default_templates, templates
```

## v2.x to v3.0.0

- **v3.0.0** - Phoenix now exclusively uses [OpenInference](https://github.com/Arize-ai/openinference) for instrumentation. OpenInference uses OpenTelemetry Protocol as the means for sending traces to a collector.

### OpenAI Tracing

#### `phoenix.trace.tracer.Tracer` is defunct and should be removed.

##### Old (v2.x)

```python
from phoenix.trace.exporter import HttpExporter  # no longer necessary
from phoenix.trace.openai import OpenAIInstrumentor
from phoenix.trace.tracer import Tracer  # no longer supported

tracer = Tracer(exporter=HttpExporter())  # no longer supported
OpenAIInstrumentor(tracer).instrument()  # tracer argument is no longer supported
```

##### New (v3.0.0)

```python
from phoenix.trace.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument()
```

---

#### Endpoint should be configured via environment variables `PHOENIX_HOST`, `PHOENIX_PORT`, or `PHOENIX_COLLECTOR_ENDPOINT`.

##### Old (v2.x)

```python
from phoenix.trace.exporter import HttpExporter  # no longer necessary
from phoenix.trace.openai import OpenAIInstrumentor
from phoenix.trace.tracer import Tracer  # no longer supported

tracer = Tracer(exporter=HttpExporter(port=12345))  # no longer supported
OpenAIInstrumentor(tracer).instrument()  # tracer argument is no longer supported
```

##### New (v3.0.0)

```python
import os
from phoenix.trace.openai import OpenAIInstrumentor

os.environ["PHOENIX_PORT"] = "12345"
OpenAIInstrumentor().instrument()
```

---

#### Calling `.get_spans()` on a tracer is no longer supported. Use `px.Client()` to get the spans as a dataframe from Phoenix.

##### Old (v2.x)

```python
from phoenix.trace.trace_dataset import TraceDataset  # no longer necessary
from phoenix.trace.tracer import Tracer  # no longer supported

tracer = Tracer()  # no longer supported
TraceDataset.from_spans(tracer.get_spans())  # no longer supported
```

##### New (v3.0.0)

```python
import phoenix as px

px.Client().get_spans_dataframe()
```

---

### LlamaIndex Tracing

#### The standard way of instrumenting your LlamaIndex application remains the same between 2.x and 3.x:

```python
from llama_index import set_global_handler

set_global_handler("arize_phoenix")
```

---

#### User should not pass Phoenix handler to a callback manager. Use the `set_global_handler` method above.

```python
from llama_index.callbacks import CallbackManager  # no longer necessary
from phoenix.trace.llama_index import OpenInferenceTraceCallbackHandler  # no longer supported

callback_handler = OpenInferenceTraceCallbackHandler()  # no longer supported
CallbackManager(handlers=[callback_handler])  # no longer supported
```

---

#### Endpoint should be configured via environment variables `PHOENIX_HOST`, `PHOENIX_PORT`, or `PHOENIX_COLLECTOR_ENDPOINT`.

##### Old (v2.x)

```python
from llama_index import set_global_handler
from phoenix.trace.exporter import HttpExporter  # no longer necessary

exporter = HttpExporter(host="127.0.0.1", port=6007)  # no longer supported
set_global_handler("arize_phoenix", exporter=exporter)
```

#### New (v3.0.0)

```python
import os
from llama_index import set_global_handler

os.environ["PHOENIX_HOST"] = "127.0.0.1"
os.environ["PHOENIX_PORT"] = "6007"
set_global_handler("arize_phoenix")
```

---

#### Calling `.get_spans()` on a handler is no longer supported. Use `px.Client()` to get the spans as a dataframe from Phoenix.

#### Old (v2.x)

```python
from phoenix.trace.trace_dataset import TraceDataset  # no longer necessary
from phoenix.trace.llama_index import OpenInferenceTraceCallbackHandler  # no longer supported

handler = OpenInferenceTraceCallbackHandler()  # no longer supported
TraceDataset.from_spans(handler.get_spans())  # .get_spans() no longer supported
```

##### New (v3.0.0)

```python
import phoenix as px

px.Client().get_spans_dataframe()
```

---

### LangChain Tracing

#### `phoenix.trace.langchain.OpenInferenceTracer` is defunct and should be removed.

##### Old (v2.x)

```python
from phoenix.trace.langchain import LangChainInstrumentor, OpenInferenceTracer

tracer = OpenInferenceTracer()  # no longer supported
LangChainInstrumentor(tracer).instrument()  # tracer argument is no longer supported
```

##### New (v3.0.0)

```python
from phoenix.trace.langchain import LangChainInstrumentor

LangChainInstrumentor().instrument()
```

---

#### Endpoint should be configured via environment variables `PHOENIX_HOST`, `PHOENIX_PORT`, or `PHOENIX_COLLECTOR_ENDPOINT`.

##### Old (v2.x)

```python
from phoenix.trace.exporter import HttpExporter  # no longer necessary
from phoenix.trace.langchain import LangChainInstrumentor, OpenInferenceTracer

tracer = OpenInferenceTracer(exporter=HttpExporter(port=12345))  # no longer supported
LangChainInstrumentor(tracer).instrument()
```

##### New (v3.0.0)

```python
from phoenix.trace.langchain import LangChainInstrumentor

os.environ["PHOENIX_PORT"] = "12345"
LangChainInstrumentor().instrument()
```

---

#### Calling `.get_spans()` on a tracer is no longer supported. Use `px.Client()` to get the spans as a dataframe from Phoenix.

##### Old (v2.x)

```python
from phoenix.trace.trace_dataset import TraceDataset  # no longer necessary
from phoenix.trace.langchain import OpenInferenceTracer  # no longer supported

tracer = OpenInferenceTracer()  # no longer supported
TraceDataset.from_spans(tracer.get_spans())  # .get_spans() no longer supported
```

##### New (v3.0.0)

```python
import phoenix as px

px.Client().get_spans_dataframe()
```

## v0.x to v1.0.0

- **v1.0.0** - Phoenix now exclusively supports the `openai>=1.0.0` sdk. If you are using an older version of the OpenAI SDK, you can continue to use `arize-phoenix==0.1.1`. However, we recommend upgrading to the latest version of the OpenAI SDK as it contains many improvements. If you are using Phoenix with LlamaIndex and and LangChain, you will have to upgrade to the versions of these packages that support the OpenAI `1.0.0` SDK as well (`llama-index>=0.8.64`, `langchain>=0.0.334`)
