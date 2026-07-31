"""
Sync this fork with upstream, resolving the conflicts that are mechanical.

A fork carrying a feature across a fast-moving upstream hits three kinds of
conflict, and only one of them is worth a human's attention:

1. **Generated artifacts** — GraphQL schema, Relay documents, OpenAPI schema and
   the generated clients. Never merge these by hand: take upstream's copy and run
   codegen, which deterministically reproduces the fork's additions on top.

2. **The migration graph** — fork-local migrations chain off whatever revision was
   upstream's head when they were written. When upstream adds one, the graph gains
   a second head, `alembic upgrade head` raises, and Phoenix will not start. Git
   reports no conflict for this. Re-pointing the earliest fork-local migration at
   the new upstream head restores a linear graph.

3. **Real overlap in hand-written code** — two people changed the same logic. This
   is the only kind that needs judgment, so the script stops and leaves it.

Usage::

    python scripts/sync_fork.py            # merge upstream, fix 1 and 2, report 3
    python scripts/sync_fork.py --check    # report only, change nothing

The merge is left uncommitted so it can be reviewed before it becomes history.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO_ROOT / "src" / "phoenix" / "db" / "migrations" / "versions"

UPSTREAM_REMOTE = "upstream"
UPSTREAM_BRANCH = "main"

# Paths whose contents are produced by codegen. A conflict in any of these is
# resolved by taking upstream's version and regenerating, never by editing.
GENERATED_PATTERNS = (
    "__generated__/",
    "app/schema.graphql",
    "schemas/openapi.json",
    "js/packages/phoenix-client/src/__generated__/",
    "packages/phoenix-client/src/phoenix/client/__generated__/",
)

# Regenerating is ordered: the GraphQL schema comes from Python, Relay reads that
# schema, and the OpenAPI clients come from the OpenAPI schema.
CODEGEN_TARGETS = ("graphql", "openapi")

DOWN_REVISION = re.compile(
    r"^(?P<prefix>down_revision(?:\s*:\s*[^=]+)?\s*=\s*)(?P<quote>['\"])(?P<revision>[^'\"]+)\2",
    re.MULTILINE,
)


def run(
    *command: str, capture: bool = True, check: bool = True
) -> subprocess.CompletedProcess[str]:
    """Run a command in the repo root."""
    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        text=True,
        capture_output=capture,
        check=check,
    )


def git(*args: str, check: bool = True) -> str:
    return run("git", *args, check=check).stdout.strip()


def is_generated(path: str) -> bool:
    return any(pattern in path for pattern in GENERATED_PATTERNS)


def fork_local_migrations() -> list[Path]:
    """
    Migration files this fork adds, oldest first.

    Determined by asking git which migration files upstream does not have, so it
    needs no bookkeeping and stays correct as migrations are added.
    """
    upstream = f"{UPSTREAM_REMOTE}/{UPSTREAM_BRANCH}"
    diff = git(
        "diff",
        "--name-only",
        "--diff-filter=A",
        f"{upstream}...HEAD",
        "--",
        str(MIGRATIONS.relative_to(REPO_ROOT)),
        check=False,
    )
    # `exists` filters out a migration added on this branch and since deleted: git
    # still reports it while the deletion is uncommitted.
    paths = [
        REPO_ROOT / line
        for line in diff.splitlines()
        if line.endswith(".py") and (REPO_ROOT / line).exists()
    ]
    by_revision = {read_revision(path): path for path in paths}
    # Ordered by following the chain, so "earliest" means the one whose parent
    # belongs to upstream — the only one that has to be re-pointed on a sync.
    root = next(
        (
            revision
            for revision, path in by_revision.items()
            if read_down_revision(path) not in by_revision
        ),
        None,
    )
    ordered: list[Path] = []
    while root is not None:
        ordered.append(by_revision[root])
        root = next(
            (
                revision
                for revision, path in by_revision.items()
                if read_down_revision(path) == root
            ),
            None,
        )
    return ordered


def read_revision(path: Path) -> str | None:
    match = re.search(
        r"^revision(?:\s*:\s*[^=]+)?\s*=\s*['\"]([^'\"]+)['\"]",
        path.read_text(),
        re.MULTILINE,
    )
    return match.group(1) if match else None


def read_down_revision(path: Path) -> str | None:
    match = DOWN_REVISION.search(path.read_text())
    return match.group("revision") if match else None


def upstream_migration_head() -> str:
    """
    The revision at the tip of upstream's migration line.

    Read from upstream's own files rather than from the merged tree, so fork-local
    migrations cannot be mistaken for the head.
    """
    upstream = f"{UPSTREAM_REMOTE}/{UPSTREAM_BRANCH}"
    listing = git(
        "ls-tree", "--name-only", f"{upstream}:src/phoenix/db/migrations/versions"
    ).splitlines()
    revisions: dict[str, str | None] = {}
    for name in listing:
        if not name.endswith(".py") or name == "__init__.py":
            continue
        source = git("show", f"{upstream}:src/phoenix/db/migrations/versions/{name}")
        revision = re.search(
            r"^revision(?:\s*:\s*[^=]+)?\s*=\s*['\"]([^'\"]+)['\"]", source, re.MULTILINE
        )
        parent = DOWN_REVISION.search(source)
        if revision:
            revisions[revision.group(1)] = parent.group("revision") if parent else None
    parents = {parent for parent in revisions.values() if parent}
    heads = [revision for revision in revisions if revision not in parents]
    if len(heads) != 1:
        raise SystemExit(f"Expected one upstream migration head, found: {sorted(heads)}")
    return heads[0]


def repoint_migration(path: Path, new_parent: str) -> bool:
    """Point a migration at a new parent revision. Returns whether it changed."""
    source = path.read_text()
    match = DOWN_REVISION.search(source)
    if not match or match.group("revision") == new_parent:
        return False
    updated = (
        source[: match.start()]
        + f"{match.group('prefix')}{match.group('quote')}{new_parent}{match.group('quote')}"
        + source[match.end() :]
    )
    path.write_text(updated)
    return True


def conflicted_paths() -> list[str]:
    return [line for line in git("diff", "--name-only", "--diff-filter=U").splitlines() if line]


def report_only() -> int:
    upstream = f"{UPSTREAM_REMOTE}/{UPSTREAM_BRANCH}"
    run("git", "fetch", UPSTREAM_REMOTE, "--quiet", capture=False)
    behind = git("rev-list", "--count", f"HEAD..{upstream}")
    print(f"commits behind {upstream}: {behind}")

    merge_base = git("merge-base", "HEAD", upstream)
    preview = run("git", "merge-tree", "--write-tree", "--name-only", "HEAD", upstream, check=False)
    conflicts = [
        line
        for line in preview.stdout.splitlines()[1:]
        if line and not line.startswith(("Auto-merging", "CONFLICT", "warning:"))
    ]
    generated = [path for path in conflicts if is_generated(path)]
    manual = [path for path in conflicts if not is_generated(path)]
    print(f"merge base: {merge_base[:9]}")
    print(
        f"would conflict: {len(conflicts)} file(s) — "
        f"{len(generated)} generated, {len(manual)} manual"
    )
    for path in manual:
        print(f"  needs judgment: {path}")
    for path in generated:
        print(f"  regenerate:     {path}")

    head = upstream_migration_head()
    migrations = fork_local_migrations()
    if not migrations:
        print("no fork-local migrations")
        return 0
    # Only the earliest chains off upstream; the rest chain off each other and are
    # unaffected by anything upstream does.
    earliest, *rest = migrations
    parent = read_down_revision(earliest)
    if parent == head:
        print(f"migration {earliest.name}: chains off upstream head {head} — ok")
    else:
        print(
            f"migration {earliest.name}: chains off {parent}, but upstream's head "
            f"is now {head} — re-point it or Phoenix will see two heads"
        )
    for path in rest:
        print(f"migration {path.name}: chains off fork-local {read_down_revision(path)} — ok")
    return 0


def sync() -> int:
    upstream = f"{UPSTREAM_REMOTE}/{UPSTREAM_BRANCH}"
    if git("status", "--porcelain"):
        raise SystemExit("Working tree is not clean. Commit or stash first.")

    run("git", "fetch", UPSTREAM_REMOTE, "--quiet", capture=False)
    print(f"merging {upstream}…")
    merge = run("git", "merge", "--no-commit", "--no-ff", upstream, check=False)
    print(merge.stdout.strip() or merge.stderr.strip())

    conflicts = conflicted_paths()
    generated = [path for path in conflicts if is_generated(path)]
    manual = [path for path in conflicts if not is_generated(path)]

    for path in generated:
        print(f"taking upstream's copy of generated file: {path}")
        run("git", "checkout", "--theirs", "--", path, check=False)
        run("git", "add", "--", path)

    head = upstream_migration_head()
    migrations = fork_local_migrations()
    if migrations:
        earliest = migrations[0]
        if repoint_migration(earliest, head):
            print(f"re-pointed {earliest.name} onto upstream head {head}")
            run("git", "add", "--", str(earliest.relative_to(REPO_ROOT)))
        else:
            print(f"{earliest.name} already chains off {head}")

    if generated:
        print("regenerating artifacts…")
        for target in CODEGEN_TARGETS:
            run("make", target, capture=False)
        run("git", "add", "--all")

    if manual:
        print("\nLeft for you — these are real overlaps in hand-written code:")
        for path in manual:
            print(f"  {path}")
        print("\nResolve them, then run: make test typecheck && git commit")
        return 1

    print("\nNo hand-written conflicts. Verify, then commit:")
    print("  uv run pytest tests/unit/db/test_migration_heads.py")
    print("  make typecheck && git commit")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="report what a sync would do without changing anything",
    )
    arguments = parser.parse_args()
    return report_only() if arguments.check else sync()


if __name__ == "__main__":
    sys.exit(main())
