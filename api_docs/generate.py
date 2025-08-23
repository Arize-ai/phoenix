from pathlib import Path
from typing import Iterable

import mkdocs_gen_files

ROOT = Path("src")

PackageSpec = tuple[str, str, str]
PACKAGES: list[PackageSpec] = [
    ("phoenix", "phoenix", "Phoenix"),
    ("phoenix.evals", "phoenix-evals", "Phoenix Evals"),
    ("phoenix.client", "phoenix-client", "Phoenix Client"),
    ("phoenix.otel", "phoenix-otel", "Phoenix OTEL"),
]


def discover_modules(package: str) -> list[str]:
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

        # Include package modules defined by __init__.py for subpackages, but
        # exclude the root package itself (phoenix, phoenix.client, etc.).
        if py.name == "__init__.py":
            module_name = ".".join(rel.parent.parts)
            if module_name == package:
                # This is the root package; skip to avoid star-exports landing page
                continue
            modules.append(module_name)
            continue

        dotted = ".".join(rel.with_suffix("").parts)
        modules.append(dotted)
    modules.sort()
    return modules


# Per-package sections: generate an index and module pages (virtual paths under docs_dir)
api_root = Path("api")
handwritten_root = Path("api")  # relative to docs_dir; mkdocs-gen-files can check real files

for pkg, outdir, title in PACKAGES:
    section_dir = api_root / outdir
    mods = discover_modules(pkg)

    # Section index listing submodules
    with mkdocs_gen_files.open(section_dir / "index.md", "w") as fd:
        print(f"# {title}", file=fd)
        if mods:
            print("\n## Modules", file=fd)
            for m in mods:
                print(f"- [{m}](./{m}.md)", file=fd)

    # One page per module, skip if a handwritten page exists
    for m in mods:
        target_md = section_dir / f"{m}.md"
        handwritten_md = handwritten_root / outdir / f"{m}.md"
        if handwritten_md.exists():
            continue
        with mkdocs_gen_files.open(target_md, "w") as fd:
            fd.write(f"# `{m}`\n\n")
            fd.write(f"::: {m}\n")

# Top-level API landing page linking to per-package sections
with mkdocs_gen_files.open(api_root / "index.md", "w") as fd:
    print("# API Reference", file=fd)
    for _pkg, outdir, title in PACKAGES:
        print(f"- [{title}](./{outdir}/index.md)", file=fd)