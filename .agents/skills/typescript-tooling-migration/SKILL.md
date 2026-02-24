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

Guide for migrating or upgrading TypeScript tooling in the Phoenix monorepo. This skill covers upgrading core dependencies (TypeScript, React), switching tools (linters, formatters, bundlers), and managing breaking changes across `app/` and `js/` directories.

## Monorepo Structure

Phoenix has two TypeScript project directories that must stay in sync:

| Directory | Purpose | Package Manager |
|-----------|---------|-----------------|
| `app/` | React/TypeScript frontend (main Phoenix UI) | pnpm |
| `js/` | TypeScript packages monorepo (phoenix-client, phoenix-evals, etc.) | pnpm (workspace) |

### Shared Dependencies

Both directories should use the same versions of shared tooling:

| Tool | Sync Enforced | Config Location |
|------|---------------|-----------------|
| pnpm | CI check | `package.json` → `packageManager` |
| TypeScript | CI check | `package.json` → `devDependencies` |
| oxlint | CI check | `package.json` → `devDependencies` |
| oxfmt | CI check | `package.json` → `devDependencies` |

### Config File Locations

| Config | Location | Purpose |
|--------|----------|---------|
| `.oxlintrc.json` | Root + `app/` + `js/` | Linter config (nested inheritance) |
| `.oxfmtrc.jsonc` | Root | Formatter config (shared) |
| `tsconfig.json` | `app/` and `js/` packages | TypeScript config |
| `vite.config.ts` | `app/` | Build/dev server config |
| `relay.config.js` | `app/` | GraphQL/Relay config |

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
   - Which directories affected (`app/`, `js/`, or both)
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
# For app/ (standard project)
cd app && pnpm add -D <package>@<version>

# For js/ (workspace root)
cd js && pnpm add -D -w <package>@<version>

# For upgrading existing dependencies
cd app && pnpm update <package>@<version>
```

**Tip:** Keep old tool installed until migration is verified for tool replacements.

### Phase 4: Update Configuration

#### For tool replacements - create new config:

Phoenix uses **nested configs with inheritance** where possible:

```
phoenix/
├── .<tool>rc.json           # Shared base config
├── app/
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

Update both `app/package.json` and `js/package.json` if script invocations changed:

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
  entry: pnpm --dir app run <script>
  language: system
  files: ^app/.*\.[jt]sx?$
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
  "<extension>.path.<binary>": "app/node_modules/<package>/bin/<binary>"
}
```

Note: `.vscode/settings.json` is gitignored - document settings in `DEVELOPMENT.md`.

### Phase 9: Remove Old Tool (for replacements)

```bash
# Remove old dependencies
cd app && pnpm remove <old-tool> <old-plugins>
cd js && pnpm remove -w <old-tool> <old-plugins>

# Delete old config files
rm app/<old-config> js/<old-config>
```

### Phase 10: Test and Verify

```bash
# Type checking
cd app && pnpm run typecheck
cd js && pnpm run typecheck

# Linting
cd app && pnpm run lint
cd js && pnpm run lint

# Formatting
cd app && pnpm run fmt:check
cd js && pnpm run fmt:check

# Unit tests
cd app && pnpm test
cd js && pnpm run -r test

# Build
cd app && pnpm run build
cd js && pnpm run -r build

# E2E tests (for significant changes)
cd app && pnpm run test:e2e

# Pre-commit hooks
pre-commit run --all-files
```

### Phase 11: Update Documentation

Files to check and update:

| File | What to update |
|------|----------------|
| `AGENTS.md` | Tool versions, commands, style conventions |
| `DEVELOPMENT.md` | Setup instructions, VS Code settings |
| `app/README.md` | Tool references, test commands |
| `.cursor/rules/typescript-packages/RULE.md` | Commands, workflow instructions |
| `.claude/settings.json` | PostToolUse hooks |
| `CHANGELOG.md` | Note significant tooling changes |

### Phase 12: Add/Update Version Sync Check

For shared dependencies, ensure `.github/workflows/package-version-check.yml` enforces consistency:

```yaml
- name: Check <tool> version consistency
  run: |
    APP_VERSION=$(jq -r '.devDependencies.<tool> // empty' app/package.json)
    JS_VERSION=$(jq -r '.devDependencies.<tool> // empty' js/package.json)

    echo "app/package.json: <tool>@$APP_VERSION"
    echo "js/package.json: <tool>@$JS_VERSION"

    if [ -z "$APP_VERSION" ]; then
      echo "::error::app/package.json is missing <tool> in devDependencies"
      exit 1
    fi

    if [ -z "$JS_VERSION" ]; then
      echo "::error::js/package.json is missing <tool> in devDependencies"
      exit 1
    fi

    if [ "$APP_VERSION" != "$JS_VERSION" ]; then
      echo "::error::<tool> versions do not match!"
      exit 1
    fi

    echo "<tool> versions are consistent: $APP_VERSION"
```

## Key Principles

### Keep Directories in Sync

When upgrading shared tooling, always upgrade both `app/` and `js/` together. Version drift causes subtle bugs and CI failures.

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

1. Clear caches: `rm -rf node_modules/.cache app/dist js/**/dist`
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
- Test script manually: `pnpm --dir app run <script>`

### CI Fails But Local Passes

- Check Node version matches CI (see `.nvmrc`)
- Ensure lockfile is committed (`pnpm-lock.yaml`)
- Run with `--frozen-lockfile` locally to match CI behavior

## CI Workflows

Relevant CI files for TypeScript tooling:

| Workflow | Purpose |
|----------|---------|
| `.github/workflows/typescript-CI.yml` | app/ typecheck, lint, test |
| `.github/workflows/typescript-packages-CI.yml` | js/ build, test, lint |
| `.github/workflows/package-version-check.yml` | Version sync enforcement |
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
