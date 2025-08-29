from __future__ import annotations

import fnmatch
import importlib
import ast
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
nav = mkdocs_gen_files.Nav()  # type: ignore[attr-defined, no-untyped-call]


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
# Stronger filtering helpers
# ---------------------------

def _module_file_path(module_name: str) -> Path | None:
    """
    Resolve a module's file path under ROOT (src/) for either module.py or package/__init__.py.
    """
    parts = module_name.split(".")
    file_py = ROOT.joinpath(*parts).with_suffix(".py")
    if file_py.exists():
        return file_py
    init_py = ROOT.joinpath(*parts, "__init__.py")
    if init_py.exists():
        return init_py
    return None


def _public_symbols_for_module(module_name: str) -> List[tuple[str, str]]:
    """
    Enumerate top-level public symbols (classes and functions) using AST, excluding any
    names starting with '_' to provide a hard guarantee that private members are never rendered.
    Returns a list of (name, type) tuples where type is 'class' or 'function'.
    """
    path = _module_file_path(module_name)
    if not path:
        return []
    try:
        src = path.read_text(encoding="utf-8")
    except Exception:
        return []
    try:
        tree = ast.parse(src)
    except Exception:
        return []
    symbols: list[tuple[str, str]] = []
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            if not node.name.startswith("_"):
                symbols.append((node.name, "class"))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if not node.name.startswith("_"):
                symbols.append((node.name, "function"))
    return sorted(symbols, key=lambda x: x[0])


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
        # Enforce global exclusion of private symbols in per-symbol includes
        include_syms = [s for s in include_syms if not s.split(".")[-1].startswith("_")]
        use_per_symbol = bool(
            mode_local == "only"
            and include_syms
            and all(_is_simple_symbol_pattern(s) for s in include_syms)
        )

        # Force per-symbol rendering for phoenix.otel so top-level imports are shown directly
        if module_name == "phoenix.otel" and include_syms:
            for sym in include_syms:
                target = sym if sym.startswith(module_name + ".") else f"{module_name}.{sym}"
                print(f"::: {target}", file=fd)
                print("    options:", file=fd)
                print("      members: false", file=fd)
                print("      show_source: false", file=fd)
                print("      show_if_no_docstring: false", file=fd)
        elif use_per_symbol:
            # Emit one directive per explicitly included symbol; avoids module-level enumeration
            # entirely
            for sym in include_syms:
                # Allow dotted relative paths (e.g., "exceptions.Foo"); prefix with module_name
                # if not absolute
                target = sym if sym.startswith(module_name + ".") else f"{module_name}.{sym}"
                print(f"::: {target}", file=fd)
                print("    options:", file=fd)
                print("      members: false", file=fd)
                print("      show_source: false", file=fd)
                print("      show_if_no_docstring: false", file=fd)
        else:
            # Strong default: enumerate only public classes/functions to avoid leaking variables/privates
            public_syms = _public_symbols_for_module(module_name)
            for sym_name, sym_type in public_syms:
                target = f"{module_name}.{sym_name}"
                print(f"::: {target}", file=fd)
                print("    options:", file=fd)
                if sym_type == "class":
                    # For classes, use members: null (default) to allow filters to work
                    # members: null allows filters to be applied
                    print("      show_source: false", file=fd)
                    print("      show_if_no_docstring: false", file=fd)
                    print("      inherited_members: false", file=fd)
                    print("      filters:", file=fd)
                    print("        - '!^_'", file=fd)  # Exclude all private/protected/special
                else:
                    # For functions, don't enumerate members
                    print("      members: false", file=fd)
                    print("      show_source: false", file=fd)
                    print("      show_if_no_docstring: false", file=fd)


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
    nav = mkdocs_gen_files.Nav()  # type: ignore[attr-defined, no-untyped-call]

    # Sections and module pages
    for s in sections:
        pkg = s["package"]
        outdir = Path(s["outdir"])
        title = s["title"]
        section_dir = api_root / outdir
        section_dir.mkdir(parents=True, exist_ok=True)

        # SUMMARY: section header
        if pkg == "phoenix.otel":
            nav[(title,)] = f"api/{outdir}/phoenix.otel.md"
        else:
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
                # Package module itself; keep existing mapping for phoenix.otel (points to module page)
                if pkg != "phoenix.otel":
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
