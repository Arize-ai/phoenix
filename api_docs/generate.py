from __future__ import annotations

import fnmatch
import os
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Set, cast

import mkdocs_gen_files
import yaml

# Project layout assumptions
ROOT = Path("src")
DOCS_DIR = Path(__file__).parent.resolve()

# Legacy constant blacklist (can be overridden via catalog.yml)
BLACKLIST_MODULES: set[str] = {"phoenix.client.constants"}

# Directories (relative to docs_dir=api_docs)
api_root = Path("api")
handwritten_root = DOCS_DIR / "api"


# ---------------------------
# Helpers: files and patterns
# ---------------------------


def _load_yaml_catalog() -> Dict[str, Any]:
    """Load api_docs/catalog.yml if present."""
    catalog_path = DOCS_DIR / "catalog.yml"
    if not catalog_path.exists():
        return {}
    data: Any = yaml.safe_load(catalog_path.read_text(encoding="utf-8")) or {}
    # Ensure dict shape for type checkers
    if not isinstance(data, dict):
        return {}
    return cast(Dict[str, Any], data)


def _load_patterns_file(filename: str) -> set[str]:
    """Load allowlist.txt / blacklist.txt style files (one pattern per line)."""
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


def _as_dict(obj: Any) -> Mapping[str, Any]:
    """Return a Mapping[str, Any] if obj is a dict-like, else {}."""
    return obj if isinstance(obj, dict) else {}


def _as_list_of_str(obj: Any) -> List[str]:
    """Coerce list/tuple/set of values to a list[str]; otherwise return []"""
    if isinstance(obj, (list, tuple, set)):
        return [str(x) for x in obj]
    return []




def _specificity_score(pattern: str) -> tuple[int, int, int]:
    """A heuristic to pick the more specific glob: more literals, more segments, fewer wildcards."""
    num_literals = sum(1 for c in pattern if c not in "*?")
    num_segments = pattern.count(".") + 1
    num_wildcards = sum(1 for c in pattern if c in "*?")
    return (num_literals, num_segments, -num_wildcards)


def _is_included_by_rules(
    name: str,
    allow_patterns: set[str],
    deny_patterns: set[str],
) -> bool:
    """
    Apply allow/deny globs with 'most specific match wins'.
    If no rule matches, default is include=True.
    """
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
    return True


def _to_regex(pattern: str) -> str:
    """
    Convert a human-friendly pattern (glob-like or regex) into a regex usable by mkdocstrings filters.
    Heuristic:
      - If it contains regex-only metachars [+(){}|\\^$], treat as regex and return as-is.
      - Otherwise, treat as glob and convert via fnmatch.translate, then anchor.
    """
    if re.search(r"[+(){}|\\^$]", pattern):
        return pattern
    # Convert glob to regex
    rx = fnmatch.translate(pattern)  # e.g. '(?s:foo\\..*)\\Z'
    # Strip the (?s: ... )\Z wrapper if present
    if rx.startswith("(?s:") and rx.endswith(")\\Z"):
        core = rx[4:-3]
    elif rx.endswith("\\Z"):
        core = rx[:-2]
    else:
        core = rx
    # Anchor full string by default for predictability
    anchored = f"^{core}$" if not core.startswith("^") else core
    return anchored


def _has_front_matter_generated_false(md_path: Path) -> bool:
    """
    If file starts with YAML front matter and contains 'generated: false', return True.
    """
    try:
        text = md_path.read_text(encoding="utf-8")
    except Exception:
        return False
    if not text.startswith("---"):
        return False
    parts = text.split("\n---", 1)
    if len(parts) < 2:
        return False
    header = parts[0].strip("- \n")
    try:
        fm_obj: Any = yaml.safe_load(header)
    except Exception:
        return False
    if isinstance(fm_obj, dict):
        return fm_obj.get("generated") is False
    return False


def _first_mkdocstrings_target(md_path: Path) -> Optional[str]:
    """Find first '::: dotted.module' line in a markdown file."""
    try:
        text = md_path.read_text(encoding="utf-8")
    except Exception:
        return None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith(":::"):
            target = line[3:].strip()
            return target if target else None
    return None


def _discover_explicit_docs() -> dict[str, str]:
    """
    Map mkdocstrings target -> relative path for any handwritten md under api_docs/api/.
    If a page lacks explicit ':::' we fallback to stem if it looks like a dotted path.
    """
    mapping: dict[str, str] = {}
    if not handwritten_root.exists():
        return mapping
    for md in handwritten_root.rglob("*.md"):
        rel_from_docs = md.relative_to(DOCS_DIR).as_posix()
        target = _first_mkdocstrings_target(md)
        if not target:
            name_no_ext = md.stem
            if "." in name_no_ext:
                target = name_no_ext
        if target:
            mapping[target] = rel_from_docs
    return mapping


# ---------------------------
# Discovery
# ---------------------------


def _iter_py_files(paths: Iterable[Path]) -> Iterable[Path]:
    for p in paths:
        if p.is_dir():
            yield from _iter_py_files(p.iterdir())
        elif p.suffix == ".py":
            yield p


def _sections_from_catalog(cat: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """
    Fallback to legacy PACKAGES-style sections if catalog lacks 'sections'.
    """
    sections = cat.get("sections")
    if sections:
        return cast(List[Dict[str, Any]], sections)

    # Legacy fallback, mirror the previous PACKAGES list
    return [
        {"package": "phoenix.evals", "outdir": "phoenix-evals", "title": "Phoenix Evals"},
        {"package": "phoenix.client", "outdir": "phoenix-client", "title": "Phoenix Client"},
        {"package": "phoenix.otel", "outdir": "phoenix-otel", "title": "Phoenix OTEL"},
        {"package": "phoenix", "outdir": "phoenix", "title": "Phoenix"},
    ]


def _child_package_prefixes(root_pkg: str, all_sections: Sequence[Mapping[str, Any]]) -> Set[str]:
    """
    For a given root package (e.g., 'phoenix'), find subpackage prefixes that are
    also sections (e.g., 'phoenix.client', 'phoenix.evals', 'phoenix.otel').
    """
    prefixes: Set[str] = set()
    for s in all_sections:
        p = str(s.get("package", ""))
        if p.startswith(root_pkg + "."):
            prefixes.add(p)
    return prefixes


def discover_modules(
    package: str,
    *,
    include_globs: set[str],
    exclude_globs: set[str],
    skip_subpackages: set[str] | None = None,
) -> list[str]:
    """
    Discover python modules under 'src' for a given package, applying include/exclude globs.
    """
    pkg_parts = package.split(".")
    base = ROOT.joinpath(*pkg_parts)
    modules: list[str] = []
    if not base.exists():
        return modules

    # If a root package, skip any subpackages that are documented as their own sections
    if skip_subpackages:
        # Convert prefixes to directories to skip (only top-level subpackage directory)
        to_skip_dirs: set[Path] = set()
        for pref in skip_subpackages:
            rel = pref.split(".")[1:]  # drop common root
            if rel:
                to_skip_dirs.add(base.joinpath(rel[0]))
        search_roots = [p for p in base.iterdir() if p not in to_skip_dirs]
    else:
        search_roots = [base]

    for py in _iter_py_files(search_roots):
        path_rel = py.relative_to(ROOT)
        rel_parts = path_rel.parts
        dir_parts = rel_parts[:-1]
        base_name = rel_parts[-1]

        # Skip unwanted/unstable modules by convention
        if (
            any(part == "migrations" for part in dir_parts)
            or any(part == "__generated__" for part in dir_parts)
            or any(part.startswith("_") or part.startswith(".") for part in dir_parts)
            or (base_name.startswith("_") and base_name != "__init__.py")
            or base_name.startswith(".")
        ):
            continue

        # __init__.py defines the package module
        if py.name == "__init__.py":
            module_name = ".".join(path_rel.parent.parts)
            modules.append(module_name)
            continue

        dotted = ".".join(path_rel.with_suffix("").parts)
        modules.append(dotted)

    # Apply wildcard-aware allow/deny with specificity
    filtered = {
        m for m in modules if _is_included_by_rules(m, include_globs, exclude_globs)
    }
    return sorted(filtered)


# ---------------------------
# Page content generation
# ---------------------------


def _compose_filters_for_module(
    module_name: str,
    *,
    defaults: Mapping[str, Any],
    per_module_cfg: Mapping[str, Any],
) -> List[str]:
    """
    Build mkdocstrings 'filters' list given defaults and a module's override.

    Semantics:
      - mode: only       -> include listed patterns; then apply excludes (defaults + per-module) if inherit.
      - mode: all_except -> include defaults.include (if any); then apply excludes (defaults + per-module).
      - no per-module    -> include defaults.include (if any); then apply defaults.exclude.
    """
    filt: list[str] = []

    # Defaults
    defaults_include = _as_list_of_str(defaults.get("include"))
    defaults_exclude = _as_list_of_str(defaults.get("exclude"))
    default_inherit = bool(defaults.get("inherit_defaults", True))

    # Per-module
    mod_cfg = _as_dict(per_module_cfg.get(module_name, {}))
    sym_cfg = _as_dict(mod_cfg.get("symbols"))
    mode = str(sym_cfg.get("mode") or "").strip().lower()
    mod_include = _as_list_of_str(sym_cfg.get("include"))
    mod_exclude = _as_list_of_str(sym_cfg.get("exclude"))
    inherit = bool(sym_cfg.get("inherit_defaults", default_inherit))

    def _add_includes(seq: list[str]) -> None:
        for p in seq:
            filt.append(_to_regex(p))

    def _add_excludes(seq: list[str]) -> None:
        for p in seq:
            filt.append("!" + _to_regex(p))

    if mode == "only":
        # Only what is explicitly included
        _add_includes(mod_include)
        if inherit:
            _add_excludes(defaults_exclude)
        # Per-module excludes apply last
        _add_excludes(mod_exclude or [])
    else:
        # Default or 'all_except'
        if defaults_include:
            _add_includes(defaults_include)
        if mode == "all_except" and mod_include:
            # If someone supplied include with all_except, treat as additional includes
            _add_includes(mod_include)
        # Exclusions
        if inherit:
            _add_excludes(defaults_exclude)
        _add_excludes(mod_exclude or [])

    return filt


def _page_title_for_module(module_name: str, *, per_module_cfg: Mapping[str, Any], nav_titles: Mapping[str, Any]) -> str:
    # Per-module explicit title takes precedence
    mod_cfg = per_module_cfg.get(module_name, {}) or {}
    if "title" in mod_cfg and mod_cfg["title"]:
        return str(mod_cfg["title"])
    # Section-level title mapping for entire package
    # e.g., navigation.titles: { "phoenix.client": "Client" }
    for pkg_prefix, title in (nav_titles or {}).items():
        if module_name == pkg_prefix or module_name.startswith(pkg_prefix + "."):
            return str(title)
    # Fallback to module name
    return module_name


def _write_module_page(
    section_outdir: Path,
    module_name: str,
    *,
    per_module_cfg: Mapping[str, Any],
    defaults: Mapping[str, Any],
    render_defaults: Mapping[str, Any],
    nav_titles: Mapping[str, Any],
) -> None:
    target_md = section_outdir / f"{module_name}.md"

    # Respect handwritten pages and explicit 'generated: false'
    handwritten_md = handwritten_root / section_outdir.name / f"{module_name}.md"
    if handwritten_md.exists():
        return
    if target_md.exists() and _has_front_matter_generated_false(target_md):
        return

    # mkdocstrings filters for this module
    filters = _compose_filters_for_module(
        module_name,
        defaults=defaults,
        per_module_cfg=per_module_cfg,
    )

    # Options
    show_if_no_docstring = bool(defaults.get("show_if_no_docstring", False))
    show_root_heading = bool(render_defaults.get("show_root_heading", True))
    show_source = bool(render_defaults.get("show_source", False))
    heading_level = int(render_defaults.get("heading_level", 2))
    members_order = str(render_defaults.get("members_order", "source"))
    docstring_style = str(render_defaults.get("docstring_style", "google"))
    show_signature_annotations = bool(render_defaults.get("show_signature_annotations", True))

    # Title
    page_title = _page_title_for_module(
        module_name, per_module_cfg=per_module_cfg, nav_titles=nav_titles
    )

    with mkdocs_gen_files.open(target_md, "w") as fd:
        # YAML front matter
        print("---", file=fd)
        print(f'title: "{page_title}"', file=fd)
        print("generated: true", file=fd)
        print("---\n", file=fd)

        # Header for readability
        print(f"# `{module_name}`\n", file=fd)

        # mkdocstrings directive with inline options and selection filters (YAML-emitted to quote '!' properly)
        print(f"::: {module_name}", file=fd)
        config_block: Dict[str, Any] = {
            "options": {
                "show_root_heading": bool(show_root_heading),
                "heading_level": int(heading_level),
                "members_order": str(members_order),
                "show_source": bool(show_source),
                "docstring_style": str(docstring_style),
                "show_signature_annotations": bool(show_signature_annotations),
                "show_if_no_docstring": bool(show_if_no_docstring),
            }
        }
        if filters:
            # Keep order; YAML will quote entries like '!^_' correctly
            config_block["selection"] = {"filters": list(filters)}
        yaml_str = yaml.safe_dump(config_block, sort_keys=False)
        for line in yaml_str.splitlines():
            print(f"    {line}", file=fd)


# ---------------------------
# Generation flow
# ---------------------------


def generate_docs() -> None:
    catalog: Dict[str, Any] = _load_yaml_catalog()

    # Sections (packages/outdirs/titles)
    sections: List[Dict[str, Any]] = _sections_from_catalog(catalog)

    # Navigation behavior
    nav_cfg: Mapping[str, Any] = _as_dict(catalog.get("navigation"))
    nav_mode = str(nav_cfg.get("mode", "generated")).lower()
    nav_titles_map: Mapping[str, Any] = _as_dict(nav_cfg.get("titles"))

    # Module-level include/exclude
    mod_cfg: Mapping[str, Any] = _as_dict(catalog.get("modules"))
    global_include: Set[str] = set(_as_list_of_str(mod_cfg.get("include")))
    global_exclude: Set[str] = set(_as_list_of_str(mod_cfg.get("exclude")))

    # Legacy allow/deny files
    legacy: Mapping[str, Any] = _as_dict(catalog.get("legacy"))
    allow_file: str = str(legacy.get("allowlist_file") or "allowlist.txt")
    deny_file: str = str(legacy.get("blacklist_file") or "blacklist.txt")
    file_allow: Set[str] = _load_patterns_file(allow_file)
    file_deny: Set[str] = _load_patterns_file(deny_file)

    effective_include: Set[str] = set(global_include) | set(file_allow)
    effective_exclude: Set[str] = set(global_exclude) | set(file_deny) | set(BLACKLIST_MODULES)

    # Per-module overrides
    per_module_cfg: Mapping[str, Any] = _as_dict(mod_cfg.get("per_module"))

    # Symbol defaults and rendering defaults
    symbols_root: Mapping[str, Any] = _as_dict(catalog.get("symbols"))
    sym_defaults: Mapping[str, Any] = _as_dict(symbols_root.get("defaults"))
    render_defaults: Mapping[str, Any] = _as_dict(catalog.get("rendering"))

    # Map of explicit handwritten docs (mkdocstrings target -> relative path)
    explicit_docs: Dict[str, str] = _discover_explicit_docs()

    # Compute child package prefixes for skip logic per section
    all_child_prefixes: Dict[str, Set[str]] = {
        str(s.get("package", "")): _child_package_prefixes(str(s.get("package", "")), sections)
        for s in sections
    }

    # Generate section indexes and module pages
    with mkdocs_gen_files.open(api_root / "index.md", "w") as fd:
        print("# API Reference", file=fd)
        for s in sections:
            print(f"- [{s['title']}](./{s['outdir']}/index.md)", file=fd)

    # Build SUMMARY only if nav_mode == "generated"
    summary_lines: list[str] = []
    if nav_mode == "generated":
        summary_lines.append("- [Overview](index.md)")
        summary_lines.append("- [Guides](guides/index.md)")
        summary_lines.append("- [API Reference](api/index.md)")

    for s in sections:
        pkg = s["package"]
        outdir = Path(s["outdir"])
        title = s["title"]
        section_dir = api_root / outdir

        # Discovery with skip of child sections
        skip_children = all_child_prefixes.get(pkg) or set()
        mods = discover_modules(
            pkg,
            include_globs=effective_include,
            exclude_globs=effective_exclude,
            skip_subpackages=skip_children,
        )

        # Always include explicit handwritten docs for this section,
        # even if an allowlist is present
        explicit_for_pkg = {m for m in explicit_docs if m == pkg or m.startswith(pkg + ".")}

        # Exclude modules that belong to a child section (to avoid leakage)
        if skip_children:
            explicit_for_pkg = {
                m
                for m in explicit_for_pkg
                if not any(m == child or m.startswith(child + ".") for child in skip_children)
            }

        mods = sorted(set(mods) | explicit_for_pkg)

        # Section index page
        with mkdocs_gen_files.open(section_dir / "index.md", "w") as fd:
            print(f"# {title}", file=fd)
            if mods:
                print("\n## Modules", file=fd)
                for m in mods:
                    page_rel = f"./{m}.md"
                    # If explicit doc path exists, link there instead of generated location
                    explicit_path = explicit_docs.get(m)
                    if explicit_path:
                        page_rel = _rel_from_docs(explicit_path, within=f"api/{outdir}/")
                    print(f"- [{m}]({page_rel})", file=fd)

        # Module pages
        for m in mods:
            if explicit_docs.get(m):
                continue  # explicit page handles this module
            _write_module_page(
                section_outdir=section_dir,
                module_name=m,
                per_module_cfg=per_module_cfg,
                defaults=sym_defaults,
                render_defaults=render_defaults,
                nav_titles=nav_titles_map,
            )

        # SUMMARY: section and children
        if nav_mode == "generated":
            summary_lines.append(f"  - [{title}](api/{outdir}/index.md)")
            for m in discover_modules(
                pkg,
                include_globs=effective_include,
                exclude_globs=effective_exclude,
                skip_subpackages=skip_children,
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

    # Write SUMMARY if in generated mode
    if nav_mode == "generated":
        with mkdocs_gen_files.open("SUMMARY.md", "w") as fd:
            fd.write("\n".join(summary_lines) + "\n")


def _rel_from_docs(explicit_path: str, within: str) -> str:
    """
    Compute a relative link from a section index located at 'within' (posix path under docs_dir)
    to an explicit page at 'explicit_path' (posix path under docs_dir).
    Example: explicit_path='api/phoenix-client/phoenix.client.md', within='api/phoenix-client/'.
    """
    try:
        # Absolute paths within the docs root
        src_abs = (DOCS_DIR / explicit_path).resolve()
        base_abs = (DOCS_DIR / within).resolve()
        # If 'within' points to a directory, use it directly; otherwise use its parent
        base_dir = base_abs if base_abs.is_dir() else base_abs.parent
        rel = os.path.relpath(src_abs, start=base_dir)
        return Path(rel).as_posix()
    except Exception:
        return explicit_path


# Entry points
if __name__ == "__main__":
    generate_docs()
else:
    generate_docs()
