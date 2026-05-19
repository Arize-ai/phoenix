# Vendored tests: pydantic-ai-skills

Companion to [src/phoenix/server/agents/capabilities/skills/VENDOR.md](../../../../../../src/phoenix/server/agents/capabilities/skills/VENDOR.md).
These are upstream's tests, kept in sync with the vendored source so that
re-syncs catch regressions.

## Source

- Upstream: https://github.com/DougTrajano/pydantic-ai-skills
- Version: 0.10.1
- SHA: `d1a19c8e6dbbee5e6726c8de70aadca2966fb190`
- Copied: 2026-05-19

## Files copied

Smoke-test floor — confirms parsing, validation, types, filesystem discovery,
toolset, and capability all still work after a re-sync. Total: 103 tests.

| File                  | LoC |
| --------------------- | --- |
| `test_capability.py`  | 85  |
| `test_parsing.py`     | 112 |
| `test_validation.py`  | 145 |
| `test_types.py`       | 193 |
| `test_discovery.py`   | 306 |
| `test_toolset.py`     | 772 |

## Files NOT copied

- `test_git_registry.py` — `registries/git.py` is not vendored.
- `test_registry_composition.py` — Phoenix doesn't use registries.
- `test_local.py`, `test_programmatic_skills.py`, `test_reload.py` — Phoenix
  doesn't currently exercise script execution, the decorator API, or
  `auto_reload`. Add later if any of those start being used.
- `test_coverage_improvements.py`, `test_toolset_coverage.py` — coverage
  padding that overlaps the files above.

## Modifications from upstream

1. **Import-path rewrite.** Same sed pass as the source vendor:
   `pydantic_ai_skills` → `phoenix.server.agents.capabilities.skills`.

2. **`ruff check --fix` import sort.** One auto-fix on
   `test_toolset.py` (combined two `from … skills.local import …` lines into
   the import block).

3. **Mypy-strict fixes in `test_toolset.py`** (three localized changes):
   - Added `assert resource.uri is not None` before `Path(resource.uri)`
     (and the analogous guard for `script.uri`) so mypy can narrow the
     `str | None` to `str`.
   - Replaced `assert prompt is not None` with `assert isinstance(prompt, str)`
     before `"…" in prompt` — composing `SkillsToolset` through pydantic-ai
     wrappers widens `get_instructions()`'s return type to
     `str | InstructionPart | Sequence[…]`, and the `in` check only makes
     sense on `str`.

## Running

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 uv run pytest \
  tests/unit/server/agents/capabilities/skills/ \
  --noconftest -p pytest_asyncio.plugin
```

(Outside of `tox`, Phoenix's repo-level `conftest.py` and autoloaded
`pytest-postgresql` plugin require a libpq install. These tests don't need
either, so disable both for ad-hoc runs.)
