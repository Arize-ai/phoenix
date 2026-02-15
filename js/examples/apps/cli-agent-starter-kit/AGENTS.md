# CLI Agent Starter Kit

This is a TypeScript CLI agent starter kit with AI SDK and Anthropic integration.

## Available Skills

This project has access to Phoenix skills: `phoenix-cli`, `phoenix-tracing`, and `phoenix-evals`.

Use these skills when working with Phoenix tracing, evaluations, or the Phoenix CLI.

## Development

```bash
pnpm dev    # Run the agent
pnpm build  # Build the TypeScript
pnpm start  # Run the compiled output
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required for Anthropic API calls

## Debugging with Phoenix CLI

### Quick Trace Check

To verify traces are being captured:

```bash
npx @arizeai/phoenix-cli traces \
  --endpoint http://localhost:6006 \
  --project cli-agent-starter-kit \
  --limit 5
```

### View Recent Traces with Key Details

```bash
npx @arizeai/phoenix-cli traces \
  --endpoint http://localhost:6006 \
  --project cli-agent-starter-kit \
  --limit 5 \
  --format raw \
  --no-progress | jq '.[] | {
    traceId: .traceId,
    startTime: .spans[0].start_time,
    operation: .spans[0].attributes["operation.name"],
    model: .spans[0].attributes["ai.model.id"]
  }'
```

### Inspect Specific Trace (including tool calls)

```bash
npx @arizeai/phoenix-cli trace <trace-id> \
  --endpoint http://localhost:6006 \
  --project cli-agent-starter-kit \
  --format raw \
  --no-progress | jq '{
    traceId: .traceId,
    spanCount: (.spans | length),
    spans: [.spans[] | {
      name,
      span_kind,
      tool: .attributes["ai.toolCall.name"],
      model: .attributes["ai.model.id"]
    }]
  }'
```

### Important Notes

- **Project Name**: Must match `projectName` in `src/instrumentation.ts` (currently `cli-agent-starter-kit`)
- **Endpoint**: Local Phoenix is at `http://localhost:6006`
- **Format**: Use `--format raw --no-progress` for piping to `jq`
- **Telemetry**: ToolLoopAgent requires `experimental_telemetry: { isEnabled: true }` in constructor

### Common Span Attributes

- `operation.name` - Operation type (e.g., `ai.generateText`)
- `ai.model.id` - Model name (e.g., `claude-sonnet-4-20250514`)
- `ai.toolCall.name` - Tool name for TOOL spans
- `ai.usage.completionTokens` / `ai.usage.promptTokens` - Token counts
- `span_kind` - Span type: `AGENT`, `LLM`, `TOOL`, `CHAIN`, etc.
