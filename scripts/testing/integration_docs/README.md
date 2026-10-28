# Integration documentation harness

This harness extracts examples from published Phoenix integration docs and
runs them in isolated environments. End-to-end entries verify their spans in
Phoenix; `lint_only` entries install the documented dependencies and compile
or syntax-check the examples without contacting a provider. `skip` entries are
metadata-only routes for `always_skip` documents that have no runnable code example. `integrations.json`
is the allowlist. Other integration pages are not discovered or reported as
passing.

## Run it

Start a Phoenix server, then run:

```bash
OPENAI_API_KEY=... make test-integration-docs
```

The server endpoint defaults to `http://127.0.0.1:6006`. Set
`PHOENIX_ENDPOINT` to override it and `PHOENIX_API_KEY` when the server
requires authentication. The GitHub Actions workflow starts Phoenix with
authentication enabled and creates an ephemeral system API key for each shard,
so the examples exercise authenticated trace export without a shared Phoenix
credential. Each example runs in an isolated environment using
the dependencies from its page's `Install` code block: Python uses a temporary
venv created by `uv` with the version configured for that page (Python 3.11 by
default), Node.js uses a temporary npm project, and Go uses a temporary Go
module. Each invocation uses a distinct Phoenix project so
concurrent runs cannot satisfy one another's span check.

The runner parses the page before checking credentials. If a required
provider key is missing, it records `skipped`; parsing and harness errors
still fail. Lint-only checks install the page's packages, then use Python
bytecode compilation, TypeScript's compiler, Node syntax checks, or `go vet`
as appropriate. Reports are written to `ci-results/integration-docs/` as JSON
and Markdown. `--list` shows the enabled pages, and `--doc <path>` selects a
single enabled page.

## Add another page

Add a case to `integrations.json` only after its format is supported. Each
case defines the doc path, language, install, setup, and run section headings,
environment variables, setup extraction, output assertions, and Phoenix span
verification rules. The runner supports Python setup code in imported MDX
`<CodeBlock>` components, plus JavaScript, Go, Java, and .NET setup code in
fenced blocks.
It deliberately rejects unsupported languages and verifier types instead of
silently skipping them.

The dependency parsers read package names from `pip install`, `npm install`,
`go get`, Gradle dependency declarations, and `dotnet add package` commands
without executing shell commands from the docs. Setup
code is resolved from imported MDX components or language-tagged code fences.
For referenced components, quoted JSX props are substituted into JavaScript
template expressions. Set `project_name_prop` in the setup configuration when
the component's project name should be replaced with the run's unique project
name. The verifier polls Phoenix's versioned spans endpoint and checks the
configured span kind and required attributes.

The GitHub workflow classifies changes against the configured documents and
their shared snippets. Changes to the runner, routing config, workflow, skill
scripts, or Makefile run the full enabled set; the weekly schedule also runs
all enabled documents.
