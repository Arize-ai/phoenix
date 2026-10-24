# Integration documentation harness

This harness extracts runnable examples from published Phoenix integration
docs, runs them in isolated environments, and verifies their observable
results against a Phoenix server. `integrations.json` is the allowlist: **only
the OpenAI Python SDK page is enabled** while the harness is being established.
Other integration pages are not discovered or reported as passing.

## Run it

Start a Phoenix server, then run:

```bash
OPENAI_API_KEY=... make test-integration-docs
```

The server endpoint defaults to `http://127.0.0.1:6006`. Set
`PHOENIX_ENDPOINT` to override it and `PHOENIX_API_KEY` when the server
requires authentication. The example runs in a temporary Python 3.11
environment created by `uv`; its install requirements come from the page's
`Install` code block. Each invocation uses a distinct Phoenix project so
concurrent runs cannot satisfy one another's span check.

The runner parses the page before checking credentials. If a required
provider key is missing, it records `skipped`; parsing and harness errors
still fail. Reports are written to `ci-results/integration-docs/` as JSON
and Markdown. `--list` shows the enabled pages, and `--doc <path>` selects a
single enabled page.

## Add another page

Add a case to `integrations.json` only after its format is supported. Each
case defines the doc path, language, install and run section headings,
environment variables, setup extraction, output assertions, and Phoenix
span verification rules. The current runner accepts Python cases whose setup
code is either in imported MDX `<CodeBlock>` components or whose language
runner can be added to `run_example`. It deliberately rejects unsupported
languages and verifier types instead of silently skipping them.

The Python parser reads package names from `pip install` lines without
executing commands from the docs. Setup code is resolved from imported MDX
components, with quoted JSX props substituted into JavaScript template
expressions. Set `project_name_prop` in the setup configuration when the
component's project name should be replaced with the run's unique project name.
The verifier polls Phoenix's versioned spans endpoint and checks the configured
span kind and required attributes.

The GitHub workflow currently triggers only for the OpenAI Python page, its
shared tracer component, and harness changes. Expand those path filters and
add more allowlisted pages when their code and verification shapes are
supported.
