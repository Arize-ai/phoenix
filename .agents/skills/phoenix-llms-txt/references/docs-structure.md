# Phoenix Documentation Structure Reference

This is a snapshot of the docs directory tree for reference when auditing llms.txt completeness.
Regenerate with: `find docs/phoenix -name "*.mdx" -type f | sort`

## Key directories

| Directory | Content | llms.txt section |
|---|---|---|
| `docs/phoenix/get-started/` | Quick start guides | Quick Start |
| `docs/phoenix/tracing/` | Tracing tutorials, how-tos, concepts | Tracing |
| `docs/phoenix/evaluation/` | Eval guides, pre-built metrics, concepts | Evaluation |
| `docs/phoenix/datasets-and-experiments/` | Dataset and experiment workflows | Datasets & Experiments |
| `docs/phoenix/prompt-engineering/` | Prompt playground, management, versioning | Prompt Engineering |
| `docs/phoenix/integrations/` | Framework, provider, platform integrations | Integrations |
| `docs/phoenix/integrations/python/` | Python framework integrations (~40 pages) | Integrations |
| `docs/phoenix/integrations/typescript/` | TypeScript framework integrations (~13 pages) | Integrations |
| `docs/phoenix/integrations/java/` | Java framework integrations (~3 pages) | Integrations |
| `docs/phoenix/integrations/llm-providers/` | LLM provider integrations (~21 pages) | Integrations |
| `docs/phoenix/integrations/platforms/` | Platform integrations (Dify, Flowise, etc.) | Integrations |
| `docs/phoenix/integrations/evaluation-integrations/` | Eval library integrations | Integrations |
| `docs/phoenix/integrations/developer-tools/` | Coding agents, MCP server | Integrations |
| `docs/phoenix/settings/` | RBAC, API keys, data retention | Settings |
| `docs/phoenix/sdk-api-reference/` | SDK docs (Python, TS, REST, OpenInference) | SDK & API Reference |
| `docs/phoenix/self-hosting/` | Deployment, config, security, upgrade | Self-Hosting |
| `docs/phoenix/resources/` | FAQs, contribution guide, migration | Resources |
| `docs/phoenix/cookbook/` | Example notebooks and practical guides | Cookbooks |
| `docs/phoenix/release-notes/` | Monthly release notes (exclude individual) | — (exclude) |
| `docs/phoenix/documentation/` | Translations (jp, zh) | — (exclude) |

## External programmatic references

These are not in docs/phoenix/ but should be linked from llms.txt:

| Resource | Location | Purpose |
|---|---|---|
| OpenAPI spec | `schemas/openapi.json` | REST API specification (310KB) |
| OpenInference repo | https://github.com/Arize-ai/openinference | Instrumentation specification |
| Python SDK source | `packages/phoenix-client/`, `packages/phoenix-evals/`, `packages/phoenix-otel/` | Python SDK packages |
| TypeScript SDK source | `js/packages/phoenix-client/`, `js/packages/phoenix-evals/`, `js/packages/phoenix-otel/` | TypeScript SDK packages |
| Phoenix MCP server | `js/packages/phoenix-mcp/` | Model Context Protocol server |
| Phoenix CLI | `js/packages/phoenix-cli/` | CLI tool with docs fetcher |

## CLI docs fetcher details

The `px docs fetch` command:
- Fetches llms.txt from `https://arize.com/docs/phoenix/llms.txt`
- Parses entries with regex: `^-\s+(.+?):\s+\`(https?:\/\/[^`]+)\`(?:\s+-\s+(.*))?$`
- Filters by workflow categories via `--workflow` flag
- Downloads markdown by appending `.md` to each URL
- Default workflows: tracing, evaluation, datasets, prompts, integrations
- Source: `js/packages/phoenix-cli/src/commands/docs.ts`
- Tests: `js/packages/phoenix-cli/test/docs.test.ts` (uses symlink to real llms.txt)
