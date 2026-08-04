---
name: phoenix-sqlean
user-invocable: false
description: >
  Maintaining packages/phoenix-sqlean, the vendored fork of nalgeon/sqlean.py published as
  arize-phoenix-sqlean. Use when bumping the bundled SQLite, sqlean, or xxHash versions,
  changing its wheel matrix, or touching its publish path. Trigger on any change under
  packages/phoenix-sqlean/ or the sqlean jobs in .github/workflows/publish.yaml.
---

# phoenix-sqlean

Vendored fork of [nalgeon/sqlean.py](https://github.com/nalgeon/sqlean.py). It exists because
upstream dropped Windows wheels at SQLite 3.50.4 and ships none today.

## Bumping a bundled version

Pins live in `packages/phoenix-sqlean/Makefile`. Each has a partner that must move with it:

| Pin | Lockstep partner |
|---|---|
| `SQLITE_VERSION` | `SQLITE_RELEASE_YEAR` — the download URL embeds both; a mismatch 404s at fetch time |
| `SQLEAN_VERSION` | `SQLEAN_VERSION` in `setup.py` — compiled in as the macro `sqlean_version()` returns |
| `XXHASH_VERSION` | whatever sqlean's own `Makefile` fetches for that release |

Verify locally. **CI does not catch a pin mismatch.**

```bash
cd packages/phoenix-sqlean
make prepare-src download-sqlite download-sqlean   # always the full chain:
                                                   # download-sqlean APPENDS init.c to the
                                                   # amalgamation, so running it alone double-appends
python setup.py build_ext -i
python -m tests
```

## Gotchas

- **`src/test_windirent.h` is pinned at 3.50.4 — do not re-sync it.** SQLite removed the file in
  3.51.0 and no newer tag has it. It is vendored deliberately, not downloaded.
- **sqlean >= 0.28 needs `crypto/xxhash.impl.h`, which sqlean does not ship.** The Makefile fetches
  it from xxHash. Any new third-party source needs a `THIRD_PARTY_LICENSES` section *and* its SPDX
  identifier added to `license=` in `setup.py`.
- **`patch(1)` failing on `src/sqlean-time-msvc.patch` is the intended tripwire**, not a breakage.
  Regenerate the patch against the new sqlean sources.
- **The `sqlean_version()` test is a tautology.** It compares the compiled macro against `setup.py`'s
  own constant, so a Makefile/`setup.py` mismatch still passes.
- **Keep the version plain SemVer.** release-please's version regex is unanchored, so `3.53.4.1` and
  `3.53.4.post1` silently truncate to `3.53.4`, colliding with an existing tag and no error. The
  package version is intentionally independent of the bundled SQLite version.
- **pyright's `exclude` in the root `pyproject.toml` must restate all three defaults**
  (`**/node_modules`, `**/__pycache__`, `**/.*`). Dropping `**/.*` makes pyright walk `.venv`.
  Nothing in CI runs pyright, so this fails silently in editors only.

## Wheels and publishing

- Matrix is in `publish.yaml` (`build-sqlean`): cp310–cp314 across Linux x86_64/aarch64, macOS
  x86_64/arm64, Windows AMD64/ARM64, plus an sdist carrying the C sources.
- `phoenix-sqlean-ci.yml` covers every OS/arch pair the publish job ships. `windows-11-arm` skips
  3.10 — CPython publishes no Windows ARM64 build for it.
- Publishing is gated on the tag `arize-phoenix-sqlean-v<manifest version>`. Until release-please
  creates it, `sqlean-sources` skips and nothing builds.
- PyPI uses trusted publishing with **no** GitHub environment; the publisher's Environment field
  must stay blank to match.

## Release-please paths

Changes under `packages/phoenix-sqlean/` and `.github/` are invisible to the root `arize-phoenix`
component. `.agents/`, `pyproject.toml`, and `release-please-config.json` are **not** — a `feat:`
or `fix:` touching those bumps `arize-phoenix`. Put them in a `chore:` commit, and note that this
repo squash-merges, so the split must be by PR, not by commit.
