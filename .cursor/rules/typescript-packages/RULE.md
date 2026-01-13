# TypeScript Packages (js/)

## Commands

### Development
- `pnpm install` - Install dependencies
- `pnpm run -r build` - Build all packages recursively
- `pnpm run -r test` - Test all packages recursively
- `pnpm run lint` - Lint all packages

### Release
- `pnpm changeset` - Create version changeset (required for PRs with package changes)

## Packages

Located in `js/packages/`:
- `phoenix-otel` - OpenTelemetry instrumentation
- `phoenix-client` - TypeScript client for Phoenix API
- `phoenix-evals` - Evaluation framework
- `phoenix-mcp` - Model Context Protocol integration
- `phoenix-cli` - Command-line interface
- `phoenix-config` - Configuration utilities

## Code Style

- **Node version**: 22+
- **Package manager**: pnpm
- Use ES modules (import/export), not CommonJS
- Destructure imports when possible: `import { foo } from 'bar'`
- See individual package README files for specific patterns

## Workflow

1. Always use pnpm (enforced by convention)
2. Build all packages with `pnpm run -r build`
3. Create changeset before submitting PR with package changes
4. Check package-specific `.cursor/rules/` for detailed guidelines
