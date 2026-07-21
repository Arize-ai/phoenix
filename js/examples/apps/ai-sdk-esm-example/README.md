# AI SDK ESM Example

A minimal AI SDK v7 agent written as native ESM that installs
`@arizeai/phoenix-otel` from a published tarball (currently the
[pkg.pr.new](https://pkg.pr.new) build of
[#14563](https://github.com/Arize-ai/phoenix/pull/14563)) instead of the
workspace source. Because it runs directly under `node` with no transpile
step, it exercises the package exactly as an external consumer would:

- `agent.js` imports the package as ESM and runs a traced tool-loop agent
- `check-cjs.cjs` requires the package to verify the CommonJS entry point
  still loads (the path that breaks if a dependency becomes ESM-only)

This app is deliberately excluded from the pnpm workspace so the tarball
install is real — install it standalone with npm.

## Prerequisites

- Node.js >= 22.12
- A running Phoenix instance (defaults to `http://localhost:6006`)
- An OpenAI API key (for `agent.js` only)

## Run

```bash
npm install

# Verify the CJS entry point loads (no API key needed)
npm run check:cjs

# Run the traced ESM agent
OPENAI_API_KEY=your-key npm start
```

Set `PHOENIX_COLLECTOR_ENDPOINT` and `PHOENIX_API_KEY` if your Phoenix
instance is not the local default.
