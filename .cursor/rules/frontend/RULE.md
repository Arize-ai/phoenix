# Frontend Development (app/)

## Commands

### Development

- `pnpm dev` - Start dev server with hot reload
- `pnpm run build` - Build production bundle
- `pnpm test` - Run tests

### Quality Checks

- `pnpm run lint:fix` - Fix linting issues
- `pnpm run typecheck` - Type check TypeScript
- `pnpm run build:relay` - Build GraphQL schema

## Code Style

- **Node version**: 22+ (see .nvmrc)
- **Package manager**: pnpm only (enforced by preinstall script)
- **GraphQL**: Uses Relay for data fetching
- **Styling**: Use Emotion CSS-in-JS (see `app/.cursor/rules/styling.mdc`)
- **Charts**: Use recharts with defaults from `src/components/chart/defaults.tsx`
- See `app/.cursor/rules/` for detailed styling and organization rules

## Workflow

1. Always use pnpm (not npm or yarn)
2. Run typecheck after making code changes
3. Components go in `src/components/`
4. Storybook files go in `stories/`
5. After modifying GraphQL schema in Python, run `pnpm run build:relay`

## Project Structure

- `app/src/` - Frontend source code
- `app/schema.graphql` - GraphQL schema (generated)
- `app/stories/` - Storybook files
