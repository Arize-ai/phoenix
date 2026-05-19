# Vendored: pydantic-ai-skills

This subpackage is a vendored copy of [pydantic-ai-skills][upstream], the
filesystem-based agent-skills implementation for Pydantic AI.

[upstream]: https://github.com/DougTrajano/pydantic-ai-skills

## Source

- Upstream: https://github.com/DougTrajano/pydantic-ai-skills
- Version: 0.10.1
- SHA: `d1a19c8e6dbbee5e6726c8de70aadca2966fb190`
- Copied: 2026-05-19
- License: MIT (preserved verbatim in `LICENSE`)

## Modifications from upstream

The vendored tree must remain importable under Phoenix's lint and typecheck
configuration (`make lint`, `make typecheck`). The diffs from upstream are:

1. **Import-path rewrite.** Every `pydantic_ai_skills.X` reference becomes
   `phoenix.server.agents.capabilities.skills.X`. Applied via a single sed pass
   over all `*.py` files.

2. **Removed the entire `registries/` subpackage.** Phoenix loads skills from
   the source tree only — no remote git repos, no REST registries, no
   composition wrappers. The upstream `_base.py` ABC plus `wrapper.py`,
   `filtered.py`, `prefixed.py`, `renamed.py`, `combined.py`, and the
   already-trimmed `git.py` were all unused by Phoenix and pulled in
   `gitpython` as a soft dependency. Also trimmed the matching `registries=`
   parameter, registry-cache state, `_load_registry_skills` /
   `_refresh_registry_cache` methods, and the `include_registries` arg on
   `reload()` from `toolset.py`; the `registries=` parameter from
   `capability.py`; and the `SkillRegistry` re-export from the top-level
   `__init__.py`.

   **Removed `py.typed`.** Redundant inside the Phoenix tree — the top-level
   `src/phoenix/py.typed` already marks the distribution as typed (PEP 561).

3. **`ruff format` to Phoenix's style.** Reflowed to 100-char lines and
   converted single quotes to double quotes.

4. **Line-length wraps.** Manual rewraps in docstrings, warning messages, and
   `ModelRetry` strings that exceeded 100 chars. No semantic changes.

5. **`DocstringFormat` import path fix.** Upstream imports
   `_function_schema.DocstringFormat` but the installed `pydantic-ai`
   (`1.96.1`) only exports `DocstringFormat` from `pydantic_ai.tools`. Changed
   the import in `types.py` accordingly.

6. **`SKILL_NAME_PATTERN` import path fix.** Upstream's `toolset.py` re-imports
   the constant via `types.py`, which mypy strict mode rejects as an implicit
   re-export. Changed to import directly from `._parsing`.

7. **Tests vendored separately.** A subset of upstream's `tests/` directory is
   vendored at `tests/unit/server/agents/capabilities/skills/`. See that
   directory for the list of files copied and any test-side modifications.

8. **Inline mypy-strict fixes.** Localized changes, no refactors:
   - `local.py`: removed two redundant `cast(...)` calls; renamed a shadowed
     loop variable to satisfy the assignment-narrowing rule.
   - `toolset.py`: two `# type: ignore[no-any-return]` on returns of
     `resource.load()` / `script.run()` (both return `Any` upstream); one
     `# type: ignore[override]` on `get_instructions()` because the base
     `FunctionToolset.get_instructions` returns
     `list[InstructionPart] | None` rather than `str | None`.
   - `capability.py`: one `# type: ignore[valid-type]` on the
     `AgentInstructions[AgentDepsT]` annotation (upstream uses it as a
     parametrized type alias, which mypy rejects in strict mode).

## Re-syncing

To pull a newer upstream:

```bash
cd /path/to/upstream/pydantic-ai-skills
git pull
cd /path/to/phoenix
cp -R /path/to/upstream/pydantic-ai-skills/pydantic_ai_skills/. \
      src/phoenix/server/agents/capabilities/skills
find src/phoenix/server/agents/capabilities/skills -name '*.py' -exec sed -i '' \
  -e 's/from pydantic_ai_skills/from phoenix.server.agents.capabilities.skills/g' \
  -e 's/import pydantic_ai_skills/import phoenix.server.agents.capabilities.skills/g' \
  {} +
rm -rf src/phoenix/server/agents/capabilities/skills/registries
# Then re-apply the modifications above (lint, typecheck, prune registry plumbing
# from toolset.py / capability.py / __init__.py).
```

Bump the **Version**, **SHA**, **Copied** fields above, and update the
modifications list if anything new diverges.
