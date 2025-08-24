from pathlib import Path
from typing import Iterable, Optional
import fnmatch

import mkdocs_gen_files

ROOT = Path("src")
DOCS_DIR = Path(__file__).parent.resolve()

PackageSpec = tuple[str, str, str]
PACKAGES: list[PackageSpec] = [
    ("phoenix.evals", "phoenix-evals", "Phoenix Evals"),
    ("phoenix.client", "phoenix-client", "Phoenix Client"),
    ("phoenix.otel", "phoenix-otel", "Phoenix OTEL"),
]

BLACKLIST_MODULES: set[str] = {"phoenix.client.constants"}


def _matches_any(name: str, patterns: set[str]) -> bool:
    return any(fnmatch.fnmatchcase(name, pat) for pat in patterns)


def _specificity_score(pattern: str) -> tuple[int, int, int]:
    num_literals = sum(1 for c in pattern if c not in "*?")
    num_segments = pattern.count(".") + 1
    num_wildcards = sum(1 for c in pattern if c in "*?")
    return (num_literals, num_segments, -num_wildcards)


def _is_included_by_rules(
    name: str,
    allow_patterns: set[str],
    deny_patterns: set[str],
) -> bool:
    # Collect all matches with their specificity and decision
    best_score: Optional[tuple[int, int, int]] = None
    decision: Optional[bool] = None
    for pat in allow_patterns:
        if fnmatch.fnmatchcase(name, pat):
            score = _specificity_score(pat)
            if best_score is None or score > best_score:
                best_score = score
                decision = True
    for pat in deny_patterns:
        if fnmatch.fnmatchcase(name, pat):
            score = _specificity_score(pat)
            if best_score is None or score > best_score:
                best_score = score
                decision = False
    if decision is not None:
        return decision
    # Default include if no rule matches
    return True


def discover_modules(
    package: str,
    *,
    allowlist: Optional[set[str]] = None,
    blacklist: Optional[set[str]] = None,
) -> list[str]:
    parts = package.split(".")
    base = ROOT.joinpath(*parts)
    modules: list[str] = []
    if not base.exists():
        return modules

    def iter_py_files(paths: Iterable[Path]) -> Iterable[Path]:
        for p in paths:
            if p.is_dir():
                yield from iter_py_files(p.iterdir())
            elif p.suffix == ".py":
                yield p

    if package == "phoenix":
        # Avoid duplicating subpackages documented under their own sections
        skip = {base / "evals", base / "client", base / "otel"}
        search_roots = [p for p in base.iterdir() if p not in skip]
    else:
        search_roots = [base]

    for py in iter_py_files(search_roots):
        rel = py.relative_to(ROOT)
        # Skip unwanted/unstable modules
        parts = rel.parts
        dir_parts = parts[:-1]
        base_name = parts[-1]
        if (
            any(part == "migrations" for part in dir_parts)
            or any(part == "__generated__" for part in dir_parts)
            or any(part.startswith("_") or part.startswith(".") for part in dir_parts)
            or (base_name.startswith("_") and base_name != "__init__.py")
            or base_name.startswith(".")
        ):
            continue

        # Include package modules defined by __init__.py (including root packages)
        if py.name == "__init__.py":
            module_name = ".".join(rel.parent.parts)
            modules.append(module_name)
            continue

        dotted = ".".join(rel.with_suffix("").parts)
        modules.append(dotted)
    # Apply wildcard-aware rule resolution: most specific match wins
    effective_blacklist = blacklist or BLACKLIST_MODULES
    effective_allowlist = allowlist or set()
    filtered = set()
    for m in modules:
        if _is_included_by_rules(m, effective_allowlist, effective_blacklist):
            filtered.add(m)
    discovered = sorted(filtered)
    return discovered


api_root = Path("api")
handwritten_root = DOCS_DIR / "api"


def _load_patterns_file(filename: str) -> set[str]:
    path = DOCS_DIR / filename
    if not path.exists():
        return set()
    entries: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        entries.add(s)
    return entries


def generate_docs(explicit_docs: dict[str, str]) -> None:
    file_blacklist = _load_patterns_file("blacklist.txt")
    file_allowlist = _load_patterns_file("allowlist.txt")
    effective_blacklist = BLACKLIST_MODULES | file_blacklist
    effective_allowlist = file_allowlist
    for pkg, outdir, title in PACKAGES:
        section_dir = api_root / outdir
        mods = discover_modules(
            pkg,
            allowlist=effective_allowlist,
            blacklist=effective_blacklist,
        )
        # Always include explicit handwritten docs for this package section,
        # even if an allowlist is present
        explicit_for_pkg = {m for m in explicit_docs if m == pkg or m.startswith(pkg + ".")}
        if pkg == "phoenix":
            # Do not leak subpackages into the Phoenix section
            explicit_for_pkg = {
                m
                for m in explicit_for_pkg
                if not (
                    m == "phoenix.client" or m.startswith("phoenix.client.")
                    or m == "phoenix.evals" or m.startswith("phoenix.evals.")
                    or m == "phoenix.otel" or m.startswith("phoenix.otel.")
                )
            }
        mods = sorted(set(mods) | explicit_for_pkg)

        with mkdocs_gen_files.open(section_dir / "index.md", "w") as fd:
            print(f"# {title}", file=fd)
            if mods:
                print("\n## Modules", file=fd)
                for m in mods:
                    print(f"- [{m}](./{m}.md)", file=fd)

        for m in mods:
            target_md = section_dir / f"{m}.md"
            if explicit_docs.get(m):
                continue
            handwritten_md = handwritten_root / outdir / f"{m}.md"
            if handwritten_md.exists():
                continue
            with mkdocs_gen_files.open(target_md, "w") as fd:
                fd.write(f"# `{m}`\n\n")
                fd.write(f"::: {m}\n")

    with mkdocs_gen_files.open(api_root / "index.md", "w") as fd:
        print("# API Reference", file=fd)
        for _pkg, outdir, title in PACKAGES:
            print(f"- [{title}](./{outdir}/index.md)", file=fd)

    summary_lines: list[str] = []
    summary_lines.append("- [Overview](index.md)")
    summary_lines.append("- [Guides](guides/index.md)")
    summary_lines.append("- [API Reference](api/index.md)")
    for pkg, outdir, title in PACKAGES:
        summary_lines.append(f"  - [{title}](api/{outdir}/index.md)")
        for m in discover_modules(
            pkg,
            allowlist=effective_allowlist,
            blacklist=effective_blacklist,
        ):
            explicit_path = explicit_docs.get(m)
            if explicit_path:
                summary_lines.append(f"    - [{m}]({explicit_path})")
            else:
                handwritten_md = handwritten_root / outdir / f"{m}.md"
                if handwritten_md.exists():
                    rel_from_docs = handwritten_md.relative_to(DOCS_DIR).as_posix()
                    summary_lines.append(f"    - [{m}]({rel_from_docs})")
                else:
                    summary_lines.append(f"    - [{m}](api/{outdir}/{m}.md)")

    with mkdocs_gen_files.open("SUMMARY.md", "w") as fd:
        fd.write("\n".join(summary_lines) + "\n")


def _first_mkdocstrings_target(md_path: Path) -> Optional[str]:
    try:
        text = md_path.read_text(encoding="utf-8")
    except Exception:
        return None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith(":::"):
            # ::: dotted.module
            target = line[3:].strip()
            return target if target else None
    return None


def _discover_explicit_docs() -> dict[str, str]:
    mapping: dict[str, str] = {}
    if not handwritten_root.exists():
        return mapping
    for md in handwritten_root.rglob("*.md"):
        rel_from_docs = md.relative_to(DOCS_DIR).as_posix()
        # Prefer directive target; fallback to filename sans .md if it looks like dotted path
        target = _first_mkdocstrings_target(md)
        if not target:
            name_no_ext = md.stem
            if "." in name_no_ext:
                target = name_no_ext
        if target:
            mapping[target] = rel_from_docs
    return mapping


if __name__ == "__main__":
    explicit_docs = _discover_explicit_docs()
    generate_docs(explicit_docs)
else:
    explicit_docs = _discover_explicit_docs()
    generate_docs(explicit_docs)
