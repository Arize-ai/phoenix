---
name: typescript-tooling-migration
description: Migrate or upgrade TypeScript tooling in the Phoenix monorepo. Use when upgrading TypeScript versions, switching tools (ESLint to oxlint, Prettier to oxfmt), upgrading bundlers (Vite, esbuild), or making major dependency upgrades. Triggers on requests to migrate, upgrade, or replace TypeScript/JavaScript tooling.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: TypeScript
  internal: true
---

# TypeScript Tooling Migration

Guide for migrating or upgrading TypeScript tooling in the Phoenix monorepo. This skill covers upgrading core dependencies (TypeScript, React), switching tools (linters, formatters, bundlers), and managing breaking changes across `js/app/` and `js/` directories.

## Monorepo Structure

All TypeScript code lives in a single pnpm workspace rooted at `js/`:

| Directory | Purpose |
|-----------|---------|
| `js/app/` | React/TypeScript frontend (main Phoenix UI, workspace package `phoenix-ui`) |
| `js/packages/*` | Publishable TypeScript packages (phoenix-client, phoenix-evals, etc.) |
| `js/` | Workspace root: single `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.pnpmfile.cjs` |

### Shared Dependencies

Shared tooling versions are managed at the workspace root where possible:

| Tool | Config Location |
|------|-----------------|
| pnpm | `js/package.json` → `packageManager` |
| TypeScript | `package.json` → `devDependencies` (keep `js/app` and `js` root aligned) |
| oxlint | `package.json` → `devDependencies` (keep `js/app` and `js` root aligned) |
| oxfmt | `package.json` → `devDependencies` (keep `js/app` and `js` root aligned) |

### Config File Locations

| Config | Location | Purpose |
|--------|----------|---------|
| `.oxlintrc.json` | Root + `js/app/` + `js/` | Linter config (nested inheritance) |
| `.oxfmtrc.jsonc` | Root | Formatter config (shared) |
| `tsconfig.json` | `js/app/` and `js/` packages | TypeScript config |
| `vite.config.ts` | `js/app/` | Build/dev server config |
| `relay.config.js` | `js/app/` | GraphQL/Relay config |

## Migration Types

### Type 1: Tool Replacement (e.g., ESLint → oxlint)

Complete replacement of one tool with another.

**Workflow:**
1. Research new tool's migration guide
2. Install new tool alongside old
3. Create new config, verify it works
4. Update package scripts
5. Update pre-commit hooks
6. Remove old tool and config
7. Update documentation

### Type 2: Major Version Upgrade (e.g., TypeScript 5 → 6)

Upgrading a tool to a new major version with breaking changes.

**Workflow:**
1. Read changelog/migration guide for breaking changes
2. Check compatibility of dependent packages
3. Upgrade in a branch, fix breaking changes
4. Run full test suite
5. Update any deprecated config options
6. Update documentation if APIs changed

### Type 3: Dependency Upgrade (e.g., React 18 → 19)

Upgrading a core dependency that affects application code.

**Workflow:**
1. Check compatibility matrix (React + React DOM + types)
2. Review breaking changes and new features
3. Upgrade dependencies together
4. Fix breaking changes in application code
5. Update any deprecated patterns
6. Run E2E tests to verify functionality

## Migration Workflow

### Phase 1: Research and Planning

1. **Read official migration guides** - Most tools publish upgrade guides
2. **Check GitHub issues** - Look for known migration problems
3. **Identify scope:**
   - Which directories affected (`js/app/`, `js/`, or both)
   - What config files need changes
   - What dependencies to add/remove/upgrade
   - What code changes are required
4. **Review current configs** - Understand existing setup before changing
5. **Check dependent packages** - Ensure compatibility across the dependency tree

### Phase 2: Create a Migration Branch

```bash
git checkout -b chore/migrate-<tool>-to-<version>
# or
git checkout -b chore/upgrade-<tool>-<version>
```

### Phase 3: Install/Upgrade Dependencies

```bash
# For js/app/ (the app workspace package)
cd js/app && pnpm add -D <package>@<version>

# For js/ (workspace root)
cd js && pnpm add -D -w <package>@<version>

# For upgrading existing dependencies
cd js/app && pnpm update <package>@<version>
```

**Tip:** Keep old tool installed until migration is verified for tool replacements.

### Phase 4: Update Configuration

#### For tool replacements - create new config:

Phoenix uses **nested configs with inheritance** where possible:

```
phoenix/
├── .<tool>rc.json           # Shared base config
├── js/app/
│   └── .<tool>rc.json       # Extends base, adds React-specific options
└── js/
    └── .<tool>rc.json       # Extends base, adds Node-specific options
```

**Config inheritance pattern:**
```json
{
  "$schema": "./node_modules/<tool>/configuration_schema.json",
  "extends": ["../.<tool>rc.json"]
}
```

#### For version upgrades - update existing config:

1. Check for deprecated options in the changelog
2. Update or remove deprecated settings
3. Add any new required settings

### Phase 5: Fix Breaking Changes

#### Code changes:
- Fix type errors from stricter checks
- Update deprecated API usage
- Adapt to new syntax requirements

#### Config changes:
- Update deprecated config options
- Adjust for changed defaults

**Tip:** Use the tool's own CLI to identify issues:
```bash
pnpm run typecheck  # TypeScript errors
pnpm run lint       # Linter errors
pnpm run build      # Build errors
```

### Phase 6: Update Package Scripts

Update both `js/app/package.json` and `js/package.json` if script invocations changed:

```json
{
  "scripts": {
    "lint": "<new-command>",
    "typecheck": "<new-command>"
  }
}
```

### Phase 7: Update Pre-commit Hooks

Edit `.pre-commit-config.yaml` if the tool is used in pre-commit:

1. Remove old tool's hook (for replacements)
2. Update or add new hook:

```yaml
- id: <tool>-app
  name: <tool> (app)
  entry: pnpm --dir js/app run <script>
  language: system
  files: ^js/app/.*\.[jt]sx?$
  pass_filenames: false
- id: <tool>-js
  name: <tool> (js)
  entry: pnpm --dir js run <script>
  language: system
  files: ^js/.*\.[jt]sx?$
  pass_filenames: false
```

### Phase 8: Update Editor Settings

1. Update `.vscode/extensions.json` if extensions changed
2. Document any path/binary settings in `DEVELOPMENT.md`:

```json
{
  "<extension>.path.<binary>": "js/app/node_modules/<package>/bin/<binary>"
}
```

Note: `.vscode/settings.json` is gitignored - document settings in `DEVELOPMENT.md`.

### Phase 9: Remove Old Tool (for replacements)

```bash
# Remove old dependencies
cd js/app && pnpm remove <old-tool> <old-plugins>
cd js && pnpm remove -w <old-tool> <old-plugins>

# Delete old config files
rm js/app/<old-config> js/<old-config>
```

### Phase 10: Test and Verify

```bash
# Type checking
cd js/app && pnpm run typecheck
cd js && pnpm run typecheck

# Linting
cd js/app && pnpm run lint
cd js && pnpm run lint

# Formatting
cd js/app && pnpm run fmt:check
cd js && pnpm run fmt:check

# Unit tests
cd js/app && pnpm test
cd js && pnpm run -r test

# Build
cd js/app && pnpm run build
cd js && pnpm run -r build

# E2E tests (for significant changes)
cd js/app && pnpm run test:e2e

# Pre-commit hooks
pre-commit run --all-files
```

### Phase 11: Update Documentation

Files to check and update:

| File | What to update |
|------|----------------|
| `AGENTS.md` | Tool versions, commands, style conventions |
| `DEVELOPMENT.md` | Setup instructions, VS Code settings |
| `js/app/README.md` | Tool references, test commands |
| `.cursor/rules/typescript-packages/RULE.md` | Commands, workflow instructions |
| `.claude/settings.json` | PostToolUse hooks |
| `CHANGELOG.md` | Note significant tooling changes |

### Phase 12: Keep Shared Tool Versions Aligned

The app (`js/app/package.json`) and the workspace root (`js/package.json`) both
declare shared tooling (typescript, oxlint, oxfmt). Keep those versions aligned
when upgrading — the single lockfile makes drift visible in review.

## Key Principles

### Keep Packages in Sync

When upgrading shared tooling, upgrade `js/app/` and the `js/` workspace root together. Version drift causes subtle bugs and CI failures.

### Performance Matters

- Measure before/after for build times, lint times, test times
- Some compatibility layers (like JS plugins for linters) add significant overhead
- Prefer native implementations over compatibility shims

### Backwards Compatibility

- Many tools support legacy config formats (e.g., oxlint supports `eslint-disable` comments)
- Don't mass-update working code unless there's a clear benefit
- Deprecation warnings are informational - fix them but don't block on them

### Config Location Strategy

| Scenario | Approach |
|----------|----------|
| Identical config for both dirs | Single root config |
| Shared base + dir-specific overrides | Root config + nested configs with `extends` |
| Completely different configs per dir | Separate configs (no inheritance) |

### Out of Scope Directories

These directories have their own tooling and should NOT be included in migrations:
- `scripts/docker/devops/oidc-server/` - Separate OIDC test server
- `scripts/mock-llm-server/` - Separate mock server  
- `internal_docs/` - Internal documentation utilities

## Troubleshooting

### TypeScript Upgrade Issues

**Stricter type checking:** New TypeScript versions often add stricter checks. Fix errors by:
1. Adding explicit type annotations
2. Using type assertions where appropriate
3. Updating `tsconfig.json` to temporarily relax checks if needed

**Dependency type mismatches:** Ensure `@types/*` packages are compatible with the new TS version.

### Build Failures After Upgrade

1. Clear caches: `rm -rf node_modules/.cache js/app/dist js/**/dist`
2. Reinstall: `pnpm install`
3. Rebuild: `pnpm run build`

### Config Not Found

- Check `$schema` path is relative to the config file location
- For nested configs, verify `extends` path (e.g., `"../.toolrc.json"`)

### Editor Not Using Updated Tool

1. Ensure extension is up to date
2. Set explicit binary path in VS Code settings
3. Reload VS Code window (`Cmd+Shift+P` → "Reload Window")

### Pre-commit Hook Fails

- Run `pnpm install` in both directories
- Verify script name in `package.json` matches hook entry
- Test script manually: `pnpm --dir js/app run <script>`

### CI Fails But Local Passes

- Check Node version matches CI (see `.nvmrc`)
- Ensure lockfile is committed (`pnpm-lock.yaml`)
- Run with `--frozen-lockfile` locally to match CI behavior

## CI Workflows

Relevant CI files for TypeScript tooling:

| Workflow | Purpose |
|----------|---------|
| `.github/workflows/typescript-CI.yml` | Whole js/ workspace (app + packages): build, typecheck, fmt, lint, codegen drift, test |
| `.github/workflows/playwright.yaml` | E2E tests |

## References

### General
- [TypeScript Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/overview.html)
- [React Release Notes](https://react.dev/blog)
- [Vite Migration Guide](https://vite.dev/guide/migration)

### Current Tools
- [Oxlint docs](https://oxc.rs/docs/guide/usage/linter)
- [Oxfmt docs](https://oxc.rs/docs/guide/usage/formatter)
- [pnpm docs](https://pnpm.io/)
