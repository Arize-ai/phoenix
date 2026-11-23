"""Check that every README.<lang>.md stays structurally in sync with README.md.

Translations mirror README.md line for line. For each line, the links, image
and badge URLs, inline code, and HTML tags must match the English line exactly;
only the surrounding prose may differ. Lines with no prose (HTML blocks, code,
badge-only table rows) must be byte-identical. The language bar line and the
Scarf pixel's ``page=`` parameter are expected to differ per language.

Relative link targets are compared after resolving them against each file's
directory, so a translation in docs/i18n/ links ``../../MIGRATION.md`` where
README.md links ``./MIGRATION.md``.

Usage: python scripts/check_readme_translations.py [docs/i18n/README.<lang>.md ...]
With no arguments, every docs/i18n/README.*.md is checked.
"""

import posixpath
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
I18N = ROOT / "docs" / "i18n"
TOKEN = re.compile(
    r"!\[[^\]]*\]\([^)]*\)|\]\([^)]*\)|`[^`]+`|<[^>]+>"
    r"|\[!(?:NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]|https?://\S+"
)
LANG_BAR = re.compile(r'<a href="[\w./-]*README(\.[\w-]+)?\.md">')
SCARF_PAGE = re.compile(r"page=README[\w.-]*\.md")
LINK_TARGET = re.compile(r'(\]\(|href="|src=")([^)"\s]+)')
ABSOLUTE = re.compile(r"[a-zA-Z][a-zA-Z0-9+.-]*:|#|/")


def resolve_links(line: str, base: str) -> str:
    """Rewrite relative link targets as paths from the repository root."""

    def repl(m: re.Match[str]) -> str:
        target = m.group(2)
        if ABSOLUTE.match(target):
            return m.group(0)
        return m.group(1) + posixpath.normpath(posixpath.join(base, target))

    return LINK_TARGET.sub(repl, line)


def tokens(line: str) -> Counter[str]:
    found = []
    for tok in TOKEN.findall(line):
        # Anchor targets are retargeted to translated headings.
        found.append("](#anchor)" if tok.startswith("](#") else tok)
    return Counter(found)


def has_prose(line: str) -> bool:
    return bool(re.search(r"[A-Za-z]{2}", TOKEN.sub("", line)))


def leading(line: str) -> str:
    m = re.match(r"\s*(#+|-|>|\||\d+\.)?", line)
    return (m.group(1) or "") if m else ""


def check(english: list[str], path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").split("\n")
    base = path.resolve().parent.relative_to(ROOT).as_posix()
    # A translation may end with a translator's note after the mirrored content.
    if len(lines) < len(english):
        return [f"{path.name}: {len(lines)} lines, README.md has {len(english)}"]
    errors = []
    in_code = False
    for n, (en, tr) in enumerate(zip(english, lines), start=1):
        stripped = en.strip()
        if stripped.startswith("```"):
            in_code = not in_code
        if len(LANG_BAR.findall(en)) > 3:
            continue
        en, tr = SCARF_PAGE.sub("page=*", en), SCARF_PAGE.sub("page=*", tr)
        en, tr = resolve_links(en, "."), resolve_links(tr, base)
        translatable = (
            stripped.startswith("# ")
            if in_code
            else (
                has_prose(en)
                and not stripped.startswith(("<", "&nbsp;"))
                and not re.fullmatch(r"\|?[\s:\-|]+\|?", stripped)
            )
        )
        if not translatable:
            if en != tr:
                errors.append(f"{path.name}:{n}: must be identical to README.md")
            continue
        if tokens(en) != tokens(tr):
            missing = tokens(en) - tokens(tr)
            extra = tokens(tr) - tokens(en)
            errors.append(
                f"{path.name}:{n}: links/code/tags differ"
                f" (missing {sorted(missing)}, extra {sorted(extra)})"
            )
        if leading(en) != leading(tr):
            errors.append(f"{path.name}:{n}: leading markup differs")
        if stripped.startswith("|") and en.count("|") != tr.count("|"):
            errors.append(f"{path.name}:{n}: table cell count differs")
    return errors


def main() -> int:
    english = (ROOT / "README.md").read_text(encoding="utf-8").split("\n")
    paths = [Path(p) for p in sys.argv[1:]] or sorted(I18N.glob("README.*.md"))
    errors = [e for p in paths for e in check(english, p)]
    for e in errors:
        print(e)
    print(f"Checked {len(paths)} translation(s): {len(errors)} problem(s).")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
