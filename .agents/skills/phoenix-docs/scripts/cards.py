#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12,<3.13"  # fingerprints hash an AST dump, which varies by minor
# dependencies = ["pillow>=13", "resvg-py>=0.5"]
# ///
"""Generate, publish and link the art behind docs <Card img> slots.

The manifest (assets/cards/cards.toml) is the source of truth. Each card
renders to a 1200x675 AVIF named <id>.<fingerprint>.avif, where the
fingerprint hashes the card spec, its logo files and card_design.py. Objects in
GCS are immutable: a changed card gets a new name, and docs only move to it
when `relink` rewrites the MDX.

    ./cards.py render [ID ...] [--sheet]   # render locally for review
    ./cards.py status [--check]            # manifest vs. GCS vs. MDX drift
    ./cards.py push [ID ...]               # upload renders missing from GCS
    ./cards.py relink [ID ...] [--dry-run] # point MDX at current renders
    ./cards.py url ID                      # print a card's public URL
    ./cards.py logo NAME SOURCE            # vendor a logo (lobehub:x, simple:x, lucide:x, URL)
"""

from __future__ import annotations

import argparse
import ast
import base64
import functools
import hashlib
import io
import json
import re
import subprocess
import sys
import tomllib
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import resvg_py
from PIL import Image, ImageStat

sys.path.insert(0, str(Path(__file__).resolve().parent))
import card_design as design  # noqa: E402

SKILL = Path(__file__).resolve().parent.parent
ASSETS = SKILL / "assets" / "cards"
MANIFEST = ASSETS / "cards.toml"
LOGOS = ASSETS / "logos"
REPO = SKILL.parents[2]
DOCS = REPO / "docs"
CACHE = Path.home() / ".cache" / "phoenix-docs-cards"

BUCKET = "arize-phoenix-assets"
PREFIX = "assets/images/docs-cards"
PUBLIC = f"https://storage.googleapis.com/{BUCKET}/{PREFIX}"
CACHE_CONTROL = "public, max-age=31536000, immutable"

# Part of every fingerprint: changing the encoder re-renders every card.
ENCODE = {"format": "AVIF", "quality": 62, "speed": 4, "subsampling": "4:2:0"}

MANAGED = re.compile(re.escape(PUBLIC) + r"/([a-z0-9][a-z0-9-]*)\.([0-9a-f]{8})\.avif")
CARD_TAG = re.compile(r"<Card\b[^>]*>", re.S)
IMG_ATTR = re.compile(r'\bimg="([^"]+)"')
ATTR = re.compile(r'\b(title|href)="([^"]*)"')
MATCH_KEYS = ("title", "href")

SOURCES = {
    "lobehub": "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.101.0/icons/{}.svg",
    "simple": "https://cdn.jsdelivr.net/npm/simple-icons@16.36.0/icons/{}.svg",
    "lucide": "https://cdn.jsdelivr.net/npm/lucide-static@1.64.0/icons/{}.svg",
}
LICENSES = {"lobehub": "MIT", "simple": "CC0-1.0", "lucide": "ISC"}


# --- Manifest ------------------------------------------------------------------


@dataclass(frozen=True)
class Card:
    id: str
    spec: dict  # everything that affects pixels
    replaces: tuple[str, ...]
    match: dict[str, str]  # attribute -> regex a legacy <Card> must match for `relink`

    @property
    def marks(self) -> list[str]:
        logo = [self.spec["logo"]] if self.spec.get("logo") else []
        return logo + list(self.spec.get("badges", []))


def load_cards() -> dict[str, Card]:
    raw = tomllib.loads(MANIFEST.read_text())["cards"]
    cards = {}
    for card_id, entry in raw.items():
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", card_id):
            sys.exit(f"cards.toml: id {card_id!r} must be lowercase kebab-case")
        entry = dict(entry)
        replaces = tuple(entry.pop("replaces", ()))
        match = {key: entry.pop(key) for key in MATCH_KEYS if key in entry}
        cards[card_id] = Card(card_id, {"id": card_id, **entry}, replaces, match)
    return cards


def select(cards: dict[str, Card], ids: list[str]) -> list[Card]:
    unknown = [i for i in ids if i not in cards]
    if unknown:
        sys.exit(f"unknown card id(s): {', '.join(unknown)}")
    return [cards[i] for i in ids] if ids else list(cards.values())


# --- Assets --------------------------------------------------------------------


def mark_path(name: str) -> Path:
    for ext in (".svg", ".png"):
        path = LOGOS / f"{name}{ext}"
        if path.exists():
            return path
    sys.exit(f"no logo named {name!r} in {LOGOS.relative_to(REPO)}; add it with `cards.py logo`")


def fetch(url: str) -> bytes:
    """Download once, then serve from the local cache."""
    path = CACHE / "src" / hashlib.sha256(url.encode()).hexdigest()[:16]
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=30) as resp:
            path.write_bytes(resp.read())
    return path.read_bytes()


def rasterize(path: Path) -> Image.Image:
    if path.suffix == ".svg":
        png = resvg_py.svg_to_bytes(svg_path=str(path), width=640, skip_system_fonts=True)
        return Image.open(io.BytesIO(bytes(png))).convert("RGBA")
    return Image.open(path).convert("RGBA")


def measure(name: str) -> design.Mark:
    path = mark_path(name)
    img = rasterize(path)
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        sys.exit(f"logo {name!r} renders empty")
    density = ImageStat.Stat(alpha.crop(bbox)).mean[0] / 255
    mime = "image/svg+xml" if path.suffix == ".svg" else "image/png"
    href = f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"
    x0, y0, x1, y1 = bbox
    return design.Mark(
        href=href,
        aspect=img.height / img.width,
        bbox=(x0 / img.width, y0 / img.height, x1 / img.width, y1 / img.height),
        density=density,
    )


def screenshot(url: str) -> design.Shot:
    img = Image.open(io.BytesIO(fetch(url))).convert("RGB")
    img.thumbnail((1800, 1800))
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    href = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"
    return design.Shot(href=href, width=img.width, height=img.height)


# --- Rendering -----------------------------------------------------------------


@functools.cache
def design_digest() -> bytes:
    """card_design.py as code only, so comments, docstrings and formatting
    can change without renaming every card."""
    tree = ast.parse(Path(design.__file__).read_text())
    for node in ast.walk(tree):
        body = getattr(node, "body", None)
        if (
            isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef))
            and body
            and isinstance(body[0], ast.Expr)
            and isinstance(body[0].value, ast.Constant)
            and isinstance(body[0].value.value, str)
        ):
            node.body = body[1:] or [ast.Pass()]
    return ast.dump(tree).encode()


def fingerprint(card: Card) -> str:
    h = hashlib.sha256()
    h.update(design_digest())
    h.update(json.dumps([card.spec, ENCODE], sort_keys=True).encode())
    for name in card.marks:
        h.update(mark_path(name).read_bytes())
    if card.spec.get("src"):
        h.update(fetch(card.spec["src"]))
    return h.hexdigest()[:8]


def object_name(card: Card) -> str:
    return f"{card.id}.{fingerprint(card)}.avif"


def url_for(card: Card) -> str:
    return f"{PUBLIC}/{object_name(card)}"


def render(card: Card, out: Path) -> Path:
    path = out / object_name(card)
    if path.exists():
        return path
    marks = {name: measure(name) for name in card.marks}
    shot = screenshot(card.spec["src"]) if card.spec.get("template") == "frame" else None
    svg = design.compose(card.spec, marks, shot)
    png = resvg_py.svg_to_bytes(svg_string=svg, skip_system_fonts=True)
    img = Image.open(io.BytesIO(bytes(png))).convert("RGB")
    out.mkdir(parents=True, exist_ok=True)
    img.save(path, **ENCODE)
    return path


# --- GCS and MDX ---------------------------------------------------------------


def remote_objects() -> set[str]:
    proc = subprocess.run(
        ["gcloud", "storage", "ls", f"gs://{BUCKET}/{PREFIX}/"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        if "matched no objects" in proc.stderr:
            return set()
        sys.exit(f"gcloud storage ls failed:\n{proc.stderr}")
    return {line.rsplit("/", 1)[-1] for line in proc.stdout.split() if line}


def mdx_files() -> list[Path]:
    return sorted(p for p in DOCS.rglob("*.mdx") if "i18n" not in p.parts)


def card_refs() -> list[tuple[Path, str]]:
    """Every <Card img> in the docs as (file, img URL)."""
    refs = []
    for path in mdx_files():
        for tag in CARD_TAG.finditer(path.read_text()):
            img = IMG_ATTR.search(tag.group(0))
            if img:
                refs.append((path, img.group(1)))
    return refs


def replacement(cards: dict[str, Card], url: str, attrs: dict[str, str]) -> Card | None:
    """The card that should replace a legacy image on a <Card> with these attributes.

    Cards with `title`/`href` patterns are tried first, in manifest order, and
    the first whose patterns all match wins. A card without patterns is the
    fallback for every <Card> that uses the legacy URL.
    """
    candidates = [c for c in cards.values() if url in c.replaces]
    for card in sorted(candidates, key=lambda c: not c.match):
        if all(re.search(rx, attrs.get(key, "")) for key, rx in card.match.items()):
            return card
    return None


# --- Commands ------------------------------------------------------------------


def cmd_render(args: argparse.Namespace) -> None:
    cards = select(load_cards(), args.ids)
    out = Path(args.out)
    paths = []
    for card in cards:
        path = render(card, out)
        paths.append((card, path))
        print(f"{path.stat().st_size / 1024:6.1f} KB  {path}")
    if args.sheet:
        sheet = out / "sheet.html"
        sheet.write_text(contact_sheet(paths))
        print(f"\nsheet: {sheet}")


def cmd_status(args: argparse.Namespace) -> None:
    cards = load_cards()
    remote = remote_objects()
    refs = card_refs()
    current = {card.id: object_name(card) for card in cards.values()}
    problems = 0
    print(f"{'card':34} {'fingerprint':12} {'gcs':4} {'refs':>5} {'stale':>6}")
    for card in cards.values():
        name = current[card.id]
        ids = [MANAGED.search(u) for _, u in refs]
        mine = [m for m in ids if m and m.group(1) == card.id]
        fresh = sum(m.group(2) == name.split(".")[1] for m in mine)
        stale = len(mine) - fresh
        uploaded = name in remote
        problems += stale + (0 if uploaded or not mine else 1)
        mark = "✅" if uploaded else "➖"
        print(f"{card.id:34} {name.split('.')[1]:12} {mark:3} {fresh:>5} {stale:>6}")
    unknown = {m.group(1) for _, u in refs if (m := MANAGED.search(u)) and m.group(1) not in cards}
    for card_id in sorted(unknown):
        problems += 1
        print(f"  MDX references unknown card {card_id!r}")
    legacy: dict[str, int] = {}
    for _, url in refs:
        if not MANAGED.search(url):
            legacy[url] = legacy.get(url, 0) + 1
    print(f"\n{sum(legacy.values())} card images across {len(legacy)} URLs are not managed yet.")
    for url, n in sorted(legacy.items(), key=lambda kv: -kv[1])[: args.legacy]:
        print(f"  {n:3}  {url}")
    if args.check and problems:
        sys.exit(f"\n{problems} problem(s): run `cards.py push` and `cards.py relink`.")


def cmd_push(args: argparse.Namespace) -> None:
    cards = select(load_cards(), args.ids)
    remote = remote_objects()
    out = CACHE / "out"
    pending = [card for card in cards if object_name(card) not in remote]
    if not pending:
        print("GCS is up to date.")
        return
    for card in pending:
        path = render(card, out)
        dest = f"gs://{BUCKET}/{PREFIX}/{path.name}"
        if args.dry_run:
            print(f"would upload {dest}")
            continue
        subprocess.run(
            [
                "gcloud",
                "storage",
                "cp",
                "--no-clobber",
                f"--cache-control={CACHE_CONTROL}",
                "--content-type=image/avif",
                str(path),
                dest,
            ],
            check=True,
            capture_output=True,
        )
        print(f"uploaded {PUBLIC}/{path.name}")


def cmd_relink(args: argparse.Namespace) -> None:
    cards = load_cards()
    scope = {c.id for c in select(cards, args.ids)}
    remote = remote_objects()
    targets = {card.id: url_for(card) for card in cards.values() if card.id in scope}
    missing = [i for i, u in targets.items() if u.rsplit("/", 1)[-1] not in remote]
    if missing and not args.dry_run:
        # Linking an object that is not uploaded would ship a broken image.
        print(f"skipping {len(missing)} card(s) not in GCS yet (run push): {', '.join(missing)}")
        targets = {i: u for i, u in targets.items() if i not in missing}

    def swap(tag: re.Match[str]) -> str:
        text = tag.group(0)
        img = IMG_ATTR.search(text)
        if not img:
            return text
        url = img.group(1)
        managed = MANAGED.search(url)
        if managed:
            new = targets.get(managed.group(1))
        else:
            card = replacement(cards, url, dict(ATTR.findall(text)))
            new = targets.get(card.id) if card else None
        return text.replace(url, new) if new and new != url else text

    changed = 0
    for path in mdx_files():
        before = path.read_bytes().decode()  # keep line endings as they are
        after = CARD_TAG.sub(swap, before)
        if after != before:
            n = sum(a != b for a, b in zip(IMG_ATTR.findall(before), IMG_ATTR.findall(after)))
            changed += n
            print(f"{n:3}  {path.relative_to(REPO)}")
            if not args.dry_run:
                path.write_bytes(after.encode())
    print(f"{'would update' if args.dry_run else 'updated'} {changed} card image(s)")


def cmd_url(args: argparse.Namespace) -> None:
    print(url_for(select(load_cards(), [args.id])[0]))


def cmd_logo(args: argparse.Namespace) -> None:
    kind, _, ref = args.source.partition(":")
    if kind in SOURCES:
        url = SOURCES[kind].format(ref)
        note = f"source: {url} ({LICENSES[kind]})"
        data = fetch(url)
    elif args.source.startswith("https://"):
        url, note, data = args.source, f"source: {args.source}", fetch(args.source)
    else:
        path = Path(args.source)
        url, note, data = None, f"source: {path.name}", path.read_bytes()
    suffix = ".png" if data[:8] == b"\x89PNG\r\n\x1a\n" else ".svg"
    dest = LOGOS / f"{args.name}{suffix}"
    if suffix == ".svg":
        data = f"<!-- {note} -->\n".encode() + data
    dest.write_bytes(data)
    mark = measure(args.name)
    print(f"wrote {dest.relative_to(REPO)} (ink density {mark.density:.2f})")


def contact_sheet(paths: list[tuple[Card, Path]]) -> str:
    """Review page: every render at 4-column and 2-column docs widths."""

    def grid(cols: int, width: int) -> str:
        items = "".join(
            f'<figure><img src="{p.name}" alt=""><figcaption>{c.id}</figcaption></figure>'
            for c, p in paths
        )
        return f'<h2>{cols} columns · {width}px cards</h2><div class="g{cols}">{items}</div>'

    return f"""<!doctype html><meta charset="utf-8"><title>Card sheet</title>
<style>
body{{background:#08090A;color:#D5D7DB;font:14px system-ui;margin:32px auto;max-width:1400px}}
h2{{font-weight:600;font-size:15px;margin:32px 0 12px}}
.g4,.g2{{display:grid;gap:16px}}.g4{{grid-template-columns:repeat(auto-fill,158px)}}
.g2{{grid-template-columns:repeat(auto-fill,334px)}}
figure{{margin:0;background:#151616;border:1px solid rgba(194,196,234,.2);border-radius:16px;
overflow:hidden}}img{{display:block;width:100%}}
figcaption{{padding:12px 14px;font-weight:600;color:#fff}}
</style>{grid(4, 158)}{grid(2, 334)}"""


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("render", help="render cards locally")
    p.add_argument("ids", nargs="*")
    p.add_argument("--out", default=str(CACHE / "out"))
    p.add_argument("--sheet", action="store_true", help="also write a review page")
    p.set_defaults(func=cmd_render)

    p = sub.add_parser("status", help="report drift between manifest, GCS and MDX")
    p.add_argument("--check", action="store_true", help="exit 1 on drift")
    p.add_argument("--legacy", type=int, default=15, help="unmanaged URLs to list")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("push", help="upload renders missing from GCS")
    p.add_argument("ids", nargs="*")
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(func=cmd_push)

    p = sub.add_parser("relink", help="point MDX card images at current renders")
    p.add_argument("ids", nargs="*")
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(func=cmd_relink)

    p = sub.add_parser("url", help="print the public URL of a card")
    p.add_argument("id")
    p.set_defaults(func=cmd_url)

    p = sub.add_parser("logo", help="vendor a monochrome logo into assets/cards/logos")
    p.add_argument("name")
    p.add_argument("source", help="lobehub:<icon>, simple:<icon>, lucide:<icon>, a URL or a path")
    p.set_defaults(func=cmd_logo)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
