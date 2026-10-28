# Integration documentation harness

This harness extracts runnable examples from published Phoenix integration
docs, runs them in isolated environments, and verifies their observable
results against a Phoenix server. `integrations.json` is the allowlist. It
currently enables the OpenAI Python, Node.js, and Go SDK pages; other
integration pages are not discovered or reported as passing.

## Run it

Start a Phoenix server, then run:

```bash
OPENAI_API_KEY=... make test-integration-docs
```

The server endpoint defaults to `http://127.0.0.1:6006`. Set
`PHOENIX_ENDPOINT` to override it and `PHOENIX_API_KEY` when the server
requires authentication. Each example runs in an isolated environment using
the dependencies from its page's `Install` code block: Python uses a temporary
Python 3.11 venv created by `uv`, Node.js uses a temporary npm project, and Go
uses a temporary Go module. Each invocation uses a distinct Phoenix project so
concurrent runs cannot satisfy one another's span check.

The runner parses the page before checking credentials. If a required
provider key is missing, it records `skipped`; parsing and harness errors
still fail. Reports are written to `ci-results/integration-docs/` as JSON
and Markdown. `--list` shows the enabled pages, and `--doc <path>` selects a
single enabled page.

## Add another page

Add a case to `integrations.json` only after its format is supported. Each
case defines the doc path, language, install, setup, and run section headings,
environment variables, setup extraction, output assertions, and Phoenix span
verification rules. The runner supports Python setup code in imported MDX
`<CodeBlock>` components, plus JavaScript and Go setup code in fenced blocks.
It deliberately rejects unsupported languages and verifier types instead of
silently skipping them.

The dependency parsers read package names from `pip install`, `npm install`,
and `go get` commands without executing shell commands from the docs. Setup
code is resolved from imported MDX components or language-tagged code fences.
For referenced components, quoted JSX props are substituted into JavaScript
template expressions. Set `project_name_prop` in the setup configuration when
the component's project name should be replaced with the run's unique project
name. The verifier polls Phoenix's versioned spans endpoint and checks the
configured span kind and required attributes.

The GitHub workflow triggers for each enabled OpenAI SDK page, the shared
Python tracer component, and harness changes. Expand those path filters and
add more allowlisted pages when their code and verification shapes are
supported.
