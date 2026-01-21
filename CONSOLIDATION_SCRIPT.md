# JS/TS Tutorials Consolidation Script

## Overview
This script consolidates all JS/TypeScript tutorials from `/tutorials/` into `/js/examples/tutorials/`
to take advantage of the PNPM workspace structure.

## Commands to Run

### 1. Create the tutorials directory
```bash
mkdir -p js/examples/tutorials
```

### 2. Move the TypeScript tracing tutorial
```bash
git mv tutorials/tracing/ts-tutorial js/examples/tutorials/tracing-tutorial
```

### 3. Move the Mastra agent tutorial
```bash
git mv tutorials/agents/mastra/example-agent js/examples/tutorials/mastra-agent
```

### 4. Clean up empty directories (optional)
```bash
# Remove empty parent directories if they exist
rmdir tutorials/tracing 2>/dev/null || true
rmdir tutorials/agents/mastra 2>/dev/null || true
```

## What's Been Updated

### Workspace Configuration
- `js/pnpm-workspace.yaml` - Added `examples/tutorials/*` to the packages list

### Documentation Files
The following documentation files will be updated to point to the new locations:
- `docs/phoenix/tracing/tutorial/your-first-traces.mdx`
- `docs/phoenix/tracing/tutorial.mdx`
- `docs/phoenix/tracing/tutorial/annotations-and-evaluations.mdx`
- `docs/phoenix/tracing/tutorial/sessions.mdx`
- `docs/phoenix/integrations/typescript/mastra/mastra-tracing.mdx`
- `docs/phoenix/cookbook/ai-engineering-workflows/iterative-evaluation-and-experimentation-workflow-typescript.mdx`

All references will be updated from:
- `tutorials/tracing/ts-tutorial` → `js/examples/tutorials/tracing-tutorial`
- `tutorials/agents/mastra/example-agent` → `js/examples/tutorials/mastra-agent`

## Verification

After moving the tutorials:
1. Verify the tutorials work: `cd js/examples/tutorials/tracing-tutorial && pnpm install && pnpm start`
2. Check the workspace: `cd js && pnpm install` (should recognize the new packages)
3. Verify documentation links point to the correct locations
