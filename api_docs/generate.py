from __future__ import annotations

import fnmatch
import importlib
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Set, cast

import mkdocs_gen_files

# Avoid mypy/Pylance stub issues by importing via importlib and typing as Any
yaml: Any = importlib.import_module("yaml")

# Project layout assumptions
ROOT = Path("src")
DOCS_DIR = Path(__file__).parent.resolve()

# Directories (relative to docs_dir=api_docs)
api_root = Path("api")
handwritten_root = DOCS_DIR / "api"
nav = mkdocs_gen_files.Nav()  # type: ignore[attr-defined]


# ---------------------------
# Helpers
# ---------------------------


def _load_yaml_catalog() -> Dict[str, Any]:
    """Load api_docs/catalog.yml if present."""
    catalog_path = DOCS_DIR / "catalog.yml"
    if not catalog_path.exists():
        return {}
    data: Any = yaml.safe_load(catalog_path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        return {}
    return cast(Dict[str, Any], data)


def _as_dict(obj: Any) -> Dict[str, Any]:
    """Return a Dict[str, Any] if obj is a dict-like, else an empty dict."""
    if isinstance(obj, dict):
        return cast(Dict[str, Any], obj)
    if isinstance(obj, Mapping):
        mapping: Mapping[str, Any] = cast(Mapping[str, Any], obj)
        return dict(mapping)
    return {}


def _as_list_of_str(obj: Any) -> List[str]:
    """Coerce list/tuple/set of values to a list[str]; otherwise return []"""
    if isinstance(obj, (list, tuple, set)):
        seq: Iterable[Any] = cast(Iterable[Any], obj)
        return [str(x) for x in seq]
    return []


def _to_regex(pattern: str) -> str:
    """
    Convert a human-friendly pattern (glob-like or regex) into a regex usable by mkdocstrings filters.
    Heuristic:
      - If it contains regex-only metachars [+(){}|\\^$], treat as regex and return as-is.
      - Otherwise, treat as glob and convert via fnmatch.translate, then anchor.
    """
    if re.search(r"[+(){}|\\^$]", pattern):
        return pattern
    rx = fnmatch.translate(pattern)  # e.g. '(?s:foo\\..*)\\Z'
    if rx.startswith("(?s:") and rx.endswith(")\\Z"):
        core = rx[4:-3]
    elif rx.endswith("\\Z"):
        core = rx[:-2]
    else:
        core = rx
    anchored = f"^{core}$" if not core.startswith("^") else core
    return anchored


def _is_simple_symbol_pattern(name: str) -> bool:
    """
    True if 'name' is a concrete symbol (no glob/regex metacharacters).
    Allows dotted paths (e.g., 'exceptions.Foo') but rejects patterns like 'exceptions.*'
    """
    return not any(ch in name for ch in "*?[]^$(){}|+")


def _label_relative(module_name: str, section_pkg: str) -> str:
    """
    Build a display label for a module relative to its section package.
    - If module == section_pkg, show the last segment (e.g., 'otel' for 'phoenix.otel').
    - Else show the dotted path after removing the section prefix, e.g.,
      'resources.datasets' for 'phoenix.client.resources.datasets' within 'phoenix.client'.
    """
    m_parts = module_name.split(".")
    p_parts = section_pkg.split(".")
    if module_name == section_pkg:
        return m_parts[-1]
    rel_parts = m_parts[len(p_parts):]
    return ".".join(rel_parts) if rel_parts else m_parts[-1]


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
    Sections come from catalog.yml. Fallback to legacy PACKAGES-style sections if absent.
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


def _matches_any(name: str, patterns: Sequence[str]) -> bool:
    return any(fnmatch.fnmatchcase(name, pat) for pat in patterns)


def discover_modules(
    package: str,
    *,
    include_globs: Sequence[str],
    exclude_globs: Sequence[str],
    skip_subpackages: set[str] | None = None,
) -> list[str]:
    """
    Discover python modules under 'src' for a given package.

    Filtering semantics (simple and predictable):
      - If include_globs is empty: start with all discovered modules under the package.
      - If include_globs is non-empty: keep only modules matching at least one include glob.
      - Always exclude modules matching any exclude_globs pattern at the end.
    """
    pkg_parts = package.split(".")
    base = ROOT.joinpath(*pkg_parts)
    modules: list[str] = []
    if not base.exists():
        return modules

    # If a root package, skip any subpackages that are documented as their own sections
    if skip_subpackages:
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

    # Apply simple include then exclude
    if include_globs:
        # Always keep the root package module (e.g., "phoenix.client")
        modules = [m for m in modules if m == package or _matches_any(m, include_globs)]
    if exclude_globs:
        modules = [m for m in modules if not _matches_any(m, exclude_globs)]
    return sorted(set(modules))


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
      - mode: only       -> include listed patterns; then apply excludes (defaults + per-module)
      - mode: all_except -> include defaults.include (if any); then apply excludes
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
            rx = _to_regex(p)
            filt.append("!" + rx)
            # Also exclude when matched as a full dotted path segment
            # handles dunders like __version__
            if p in ("^_.*", "^__.*"):
                # Match names at end of full dotted path
                filt.append("!(^|.*\\.)_.*$" if p == "^_.*" else "!(^|.*\\.)__.*$")

    if mode == "only":
        _add_includes(mod_include)
        if inherit:
            _add_excludes(defaults_exclude)
        _add_excludes(mod_exclude or [])
    else:
        if defaults_include:
            _add_includes(defaults_include)
        if mode == "all_except" and mod_include:
            _add_includes(mod_include)
        if inherit:
            _add_excludes(defaults_exclude)
        _add_excludes(mod_exclude or [])

    return filt


def _page_title_for_module(module_name: str, *, per_module_cfg: Mapping[str, Any]) -> str:
    mod_cfg = per_module_cfg.get(module_name, {}) or {}
    if "title" in mod_cfg and mod_cfg["title"]:
        return str(mod_cfg["title"])
    return module_name


def _write_module_page(
    section_outdir: Path,
    module_name: str,
    *,
    per_module_cfg: Mapping[str, Any],
    defaults: Mapping[str, Any],
) -> None:
    target_md = section_outdir / f"{module_name}.md"

    # Respect handwritten pages at the canonical location
    handwritten_md = handwritten_root / section_outdir.name / f"{module_name}.md"
    if handwritten_md.exists():
        return

    # mkdocstrings filters for this module
    filters = _compose_filters_for_module(
        module_name,
        defaults=defaults,
        per_module_cfg=per_module_cfg,
    )

    page_title = _page_title_for_module(module_name, per_module_cfg=per_module_cfg)

    with mkdocs_gen_files.open(target_md, "w") as fd:
        # YAML front matter
        print("---", file=fd)
        print(f'title: "{page_title}"', file=fd)
        print("generated: true", file=fd)
        print("---\n", file=fd)

        # Header for readability
        print(f"# `{module_name}`\n", file=fd)

        # Determine if we should emit per-symbol directives (mode: only + concrete includes)
        mod_cfg_local = _as_dict(per_module_cfg.get(module_name, {}))
        sym_cfg_local = _as_dict(mod_cfg_local.get("symbols"))
        mode_local = str(sym_cfg_local.get("mode") or "").strip().lower()
        include_syms = _as_list_of_str(sym_cfg_local.get("include"))
        use_per_symbol = bool(
            mode_local == "only"
            and include_syms
            and all(_is_simple_symbol_pattern(s) for s in include_syms)
        )

        if use_per_symbol:
            # Emit one directive per explicitly included symbol; avoids module-level enumeration
            # entirely
            for sym in include_syms:
                # Allow dotted relative paths (e.g., "exceptions.Foo"); prefix with module_name
                # if not absolute
                target = sym if sym.startswith(module_name + ".") else f"{module_name}.{sym}"
                print(f"::: {target}", file=fd)
        else:
            # Fallback: module-level directive with selection limited to classes/functions and
            # filters
            print(f"::: {module_name}", file=fd)
            selection_block: Dict[str, Any] = {"members": ["classes", "functions"]}
            if filters:
                selection_block["filters"] = list(filters)
            config_block: Dict[str, Any] = {"selection": selection_block}
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

    # Module-level include/exclude (single, obvious precedence)
    mod_cfg: Dict[str, Any] = _as_dict(catalog.get("modules"))
    effective_include: List[str] = _as_list_of_str(mod_cfg.get("include"))
    effective_exclude: List[str] = _as_list_of_str(mod_cfg.get("exclude"))

    # Per-module overrides
    per_module_cfg: Dict[str, Any] = _as_dict(mod_cfg.get("per_module"))

    # Symbol defaults
    symbols_root: Dict[str, Any] = _as_dict(catalog.get("symbols"))
    sym_defaults: Dict[str, Any] = _as_dict(symbols_root.get("defaults"))

    # Compute child package prefixes for skip logic per section
    all_child_prefixes: Dict[str, Set[str]] = {
        str(s.get("package", "")): _child_package_prefixes(str(s.get("package", "")), sections)
        for s in sections
    }

    # Top-level API Reference index
    with mkdocs_gen_files.open(api_root / "index.md", "w") as fd:
        print("# API Reference", file=fd)
        for s in sections:
            print(f"- [{s['title']}](./{s['outdir']}/index.md)", file=fd)

    # Initialize nav for literate-nav
    global nav
    nav = mkdocs_gen_files.Nav()  # type: ignore[attr-defined]

    # Sections and module pages
    for s in sections:
        pkg = s["package"]
        outdir = Path(s["outdir"])
        title = s["title"]
        section_dir = api_root / outdir
        section_dir.mkdir(parents=True, exist_ok=True)

        # SUMMARY: section header
        nav[(title,)] = f"api/{outdir}/index.md"

        # Discovery with skip of child sections
        skip_children = all_child_prefixes.get(pkg) or set()
        mods = discover_modules(
            pkg,
            include_globs=effective_include,
            exclude_globs=effective_exclude,
            skip_subpackages=skip_children,
        )

        # Section index page
        with mkdocs_gen_files.open(section_dir / "index.md", "w") as fd:
            print(f"# {title}", file=fd)
            if mods:
                print("\n## Modules", file=fd)
                for m in mods:
                    page_rel = f"./{m}.md"
                    label = _label_relative(m, pkg)
                    print(f"- [{label}]({page_rel})", file=fd)

        # SUMMARY: nested module entries using mkdocs_gen_files.Nav for hierarchy
        pkg_parts = pkg.split(".")
        # Collect all intermediate prefixes for subpackages (exclude leaves)
        parent_prefixes: set[tuple[str, ...]] = set()
        for m in mods:
            rel_parts = tuple(m.split(".")[len(pkg_parts):])
            for i in range(1, len(rel_parts)):  # intermediate levels only
                parent_prefixes.add(rel_parts[:i])

        # Generate index pages for parent prefixes and add them to nav
        for prefix in sorted(parent_prefixes):
            parent_dir = section_dir.joinpath(*prefix)
            parent_dir.mkdir(parents=True, exist_ok=True)
            index_md = parent_dir / "index.md"
            # Write a minimal index page for the parent node
            with mkdocs_gen_files.open(index_md, "w") as fd:
                dotted = ".".join(pkg_parts + list(prefix))
                # Title shows relative label for clarity
                rel_label = ".".join(prefix)
                print("---", file=fd)
                print(f'title: "{rel_label or title}"', file=fd)
                print("generated: true", file=fd)
                print("---\n", file=fd)
                print(f"# `{dotted}`", file=fd)
            # Map nav to this parent index
            nav[(title,) + prefix] = f"api/{outdir}/{'/'.join(prefix)}/index.md"

        # Add leaf module pages to nav
        for m in mods:
            handwritten_md = handwritten_root / outdir / f"{m}.md"
            if handwritten_md.exists():
                link = handwritten_md.relative_to(DOCS_DIR).as_posix()
            else:
                link = f"api/{outdir}/{m}.md"
            rel_parts = tuple(m.split(".")[len(pkg_parts):])
            if rel_parts:
                nav[(title,) + rel_parts] = link
            else:
                # Package module itself; ensure section index is already mapped
                nav[(title,)] = f"api/{outdir}/index.md"

        # Module pages
        for m in mods:
            _write_module_page(
                section_outdir=section_dir,
                module_name=m,
                per_module_cfg=per_module_cfg,
                defaults=sym_defaults,
            )


# Execute once when run by mkdocs-gen-files
generate_docs()

# Write SUMMARY.md for literate-nav
with mkdocs_gen_files.open("SUMMARY.md", "w") as fd:
    fd.writelines(nav.build_literate_nav())
