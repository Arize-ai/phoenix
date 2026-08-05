---
name: phoenix-sqlean
user-invocable: false
description: >
  Maintaining packages/phoenix-sqlean, the vendored fork of nalgeon/sqlean.py published as
  arize-phoenix-sqlean. Use when bumping the bundled SQLite, sqlean, or xxHash versions,
  changing its wheel matrix, or touching its publish path. Trigger on any change under
  packages/phoenix-sqlean/, .github/workflows/phoenix-sqlean-*.yml, or the sqlean jobs in
  .github/workflows/publish.yaml.
---

# phoenix-sqlean

Vendored fork of [nalgeon/sqlean.py](https://github.com/nalgeon/sqlean.py).

## Bumping a bundled version

Pins live in `packages/phoenix-sqlean/Makefile`. Each has a partner that must move with it:

| Pin | Moves with |
|---|---|
| `SQLITE_VERSION` | `SQLITE_RELEASE_YEAR` (the URL embeds both, so a mismatch 404s) and `SQLITE_SHA256` |
| `SQLEAN_COMMIT` | `SQLEAN_VERSION` in the `Makefile` *and* in `setup.py` — the commit is what gets fetched, the strings only describe it |
| `SQLEAN_VERSION` | `setup.py`'s copy, compiled in as what `sqlean_version()` returns. Suffix `+<short sha>` iff `SQLEAN_COMMIT` sits ahead of the named tag |
| `XXHASH_TAG` | `XXHASH_COMMIT` + `XXHASH_SHA256`, and the tag sqlean's own `Makefile` fetches |

`check-sqlean-pin`, a prerequisite of `download-sqlean`, enforces the `SQLEAN_*` rows for one
`ls-remote`: suffix prefixes the commit, base is a real tag, suffix present iff ahead, `setup.py`
agrees. It cannot tell you the base names the *wrong* release — the single-commit fetch carries no
ancestry. `SQLITE_*` and `XXHASH_*` get no equivalent cross-check — only their hashes, at fetch.

sqlean is fetched over git by commit: GitHub's source archives are generated on demand and not
byte-stable, so they cannot be checksum-pinned, while git hashes every object it receives. Hence
`download-sqlean` needs `git` on PATH and no checksum. The other two arrive over plain HTTP, where
curl verifies nothing — `XXHASH_COMMIT` fixes which bytes are correct and `XXHASH_SHA256` proves
they are those. `src/test_windirent.h` needs neither; it is committed to this repo.

### With the script

`scripts/check-upstream.sh` resolves and rewrites every pin, hashes included:

```bash
cd packages/phoenix-sqlean
./scripts/check-upstream.sh sqlite            # detection only, no downloads
./scripts/check-upstream.sh sqlite --apply    # rewrite pins, print a Markdown summary
./scripts/check-upstream.sh sqlean [--apply]  # also moves XXHASH_* if sqlean moved its own
```

### By hand

Resolve a tag to a commit with `git ls-remote <repo> 'refs/tags/<version>*'`, taking the peeled
`^{}` line when the tag is annotated. sqlean also carries a non-version tag (`incubator`), so
filter by shape before picking a latest.

For `SQLITE_SHA256`, confirm the download against the SHA3-256 in the `PRODUCT` line on
<https://sqlite.org/download.html> *before* recording the SHA-256 (`shasum` cannot do SHA3).
Skipping that makes the pin trust-on-first-use.

### Verify

```bash
cd packages/phoenix-sqlean
make prepare-src download-sqlite download-sqlean   # always the full chain: download-sqlean
                                                   # APPENDS init.c, so alone it double-appends
python setup.py build_ext -i
python -m tests
```

## Staying current

Dependabot cannot see these pins — no custom-regex manager — and there is no Renovate here.
`phoenix-sqlean-upstream.yml` fills the gap: weekly, one draft PR per component, running
`check-upstream.sh --apply`, no model involved.

**It builds and tests nothing.** CI covers that on the PR; verifying inside the bump job would
re-run a subset of it, on the one platform where the likeliest failure — `patch(1)` on the MSVC
patch — cannot reproduce.

A failure of the script itself is different: upstream changed shape, so it exits before writing and
the job goes red with no PR, because there is no computed bump to review.

`XXHASH_*` is deliberately unwatched. sqlean drives it, and `download-sqlean` already fails when
sqlean moves its own pin.

## Gotchas

- **`src/test_windirent.h` is pinned at 3.50.4 — do not re-sync it.** SQLite removed it in 3.51.0
  and no newer tag has it. Vendored deliberately, not downloaded.
- **sqlean >= 0.28 needs `crypto/xxhash.impl.h`, which sqlean does not ship.** Any new third-party
  source needs a `THIRD_PARTY_LICENSES` section *and* its SPDX identifier in `license=`.
- **`patch(1)` failing on `src/sqlean-time-msvc.patch` is the intended tripwire**, not a breakage.
  Regenerate it against the new sqlean sources.
- **"sqlean fetches xxHash X, but XXHASH_TAG is Y" is the other one.** Move all three `XXHASH_*`
  pins, and the version named in `THIRD_PARTY_LICENSES`.
- **The `sqlean_version()` test is a tautology on its own** — it compares the compiled macro to
  `setup.py`'s own constant, proving only that the binary is not stale. `check-sqlean-pin` is what
  ties that constant back to `SQLEAN_COMMIT`.
- **Changing `SQLEAN_VERSION` alone does not trigger a recompile.** It only moves a `-D` flag, and
  `build_ext` keys on source mtime. `touch src/sqlean.c` after editing, or the version test fails
  against a merely stale build.
- **Keep the package version plain SemVer.** release-please's version regex is unanchored, so
  `3.53.4.1` and `3.53.4.post1` truncate to `3.53.4` and collide with an existing tag, silently.
  For the same reason `VERSION` must stay above `SQLEAN_VERSION` in `setup.py`. The package version
  is intentionally independent of the bundled SQLite version.

## Wheels and publishing

- Settings are in `cibuildwheel.toml`, steps in `phoenix-sqlean-build.yml` — a `workflow_call`
  workflow that both `build-sqlean` in `publish.yaml` and CI's `wheel` job invoke, so a PR runs
  the build a release runs.
- The matrix is cp310–cp314 across Linux x86_64/aarch64, macOS x86_64/arm64, Windows AMD64/ARM64,
  plus an sdist of the C sources. A misspelled key in the toml errors; a misspelled `CIBW_*` env
  var is a silent no-op.
- **An empty `CIBW_*` is an override, not a no-op.** It replaces the toml's value with
  cibuildwheel's own default — Linux goes from 10 identifiers to 36, musllinux and free-threaded
  included. Hence the `cibw-*` inputs reach the environment only when non-empty.
- **`test-sources` resolves against cibuildwheel's working directory, not `package-dir`** — hence
  the workspace-root unpack, which the shared workflow puts under CI.
- CI's `test` matrix compiles in place across every OS/arch pair the publish job ships;
  `windows-11-arm` skips 3.10 — CPython publishes no Windows ARM64 build for it. It never runs
  cibuildwheel, which is what the `wheel` job is for.
- Publishing is gated on the tag `arize-phoenix-sqlean-v<manifest version>`. Until release-please
  creates it, `sqlean-sources` skips and nothing builds.
- PyPI uses trusted publishing with **no** GitHub environment; the publisher's Environment field
  must stay blank to match.
