#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12,<3.13"  # fingerprints hash an AST dump, which varies by minor
# dependencies = ["pillow==13.0.0", "resvg-py==0.5.0"]  # pinned: they decide the pixels
# ///
"""Generate, publish and link the art behind docs <Card img> slots.

The manifest (assets/cards/cards.toml) is the source of truth. Each table in
it is one 1200x675 AVIF, published at a path that follows from its art:

    docs-cards/integrations/<logo>.avif          integrations/openai.avif
    docs-cards/integrations/<logo>-<badge>.avif  integrations/openai-evals.avif
    docs-cards/topics/<motif>.avif               topics/trace.avif

Paths never change, so docs link them once. Each object carries a fingerprint
of its spec, logo files and card_design.py in its GCS metadata.

    ./cards.py render [CARD ...] [--sheet]    # render locally for review
    ./cards.py status [--check]               # manifest vs. GCS vs. MDX drift
    ./cards.py push [CARD ...] [--replace]    # upload new cards; --replace changed ones
    ./cards.py relink [CARD ...] [--dry-run]  # swap legacy <Card img> URLs for cards
    ./cards.py url CARD                       # print a card's public URL
    ./cards.py logo NAME SOURCE               # vendor and normalize a logo
    ./cards.py normalize [NAME ...]           # re-normalize vendored logos

CARD is a path such as integrations/openai-evals, or just its key when unique.
"""

from __future__ import annotations

import argparse
import ast
import base64
import functools
import hashlib
import io
import json
import math
import re
import shutil
import subprocess
import sys
import tomllib
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

import resvg_py
from PIL import Image, ImageChops, ImageFilter, ImageStat

sys.path.insert(0, str(Path(__file__).resolve().parent))
import card_design as design  # noqa: E402

SKILL = Path(__file__).resolve().parent.parent
ASSETS = SKILL / "assets" / "cards"
MANIFEST = ASSETS / "cards.toml"
LOGOS = ASSETS / "logos"
REPO = SKILL.parents[2]
DOCS = REPO / "docs"
PLATFORM_ICONS = REPO / "js/app/src/components/core/icon/Icons.tsx"
CACHE = Path.home() / ".cache" / "phoenix-docs-cards"

BUCKET = "arize-phoenix-assets"
PREFIX = "assets/images/docs-cards"
PUBLIC = f"https://storage.googleapis.com/{BUCKET}/{PREFIX}"
SECTIONS = ("integrations", "topics")
# Paths are reused across design changes, so caches must expire.
CACHE_CONTROL = "public, max-age=3600"

# Part of every fingerprint: changing the encoder re-renders every card.
ENCODE = {"format": "AVIF", "quality": 62, "speed": 4, "subsampling": "4:2:0"}

KEY = r"[a-z0-9][a-z0-9-]*"
MANAGED = re.compile(re.escape(PUBLIC) + rf"/((?:{'|'.join(SECTIONS)})/{KEY})\.avif")
CARD_TAG = re.compile(r"<Card\b[^>]*>", re.S)
IMG_ATTR = re.compile(r'\bimg="([^"]+)"')
ATTR = re.compile(r'\b(title|href)="([^"]*)"')
MATCH_KEYS = ("title", "href")

SOURCES = {
    "lobehub": "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.101.0/icons/{}.svg",
    "simple": "https://cdn.jsdelivr.net/npm/simple-icons@16.36.0/icons/{}.svg",
    "lucide": "https://cdn.jsdelivr.net/npm/lucide-static@1.64.0/icons/{}.svg",
    "phosphor": "https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/fill/{}-fill.svg",
    "devicon": "https://cdn.jsdelivr.net/npm/devicon@2.18.0/icons/{}.svg",
}
LICENSES = {
    "lobehub": "MIT",
    "simple": "CC0-1.0",
    "lucide": "ISC",
    "phosphor": "MIT",
    "devicon": "MIT",
}


# --- Manifest ------------------------------------------------------------------


@dataclass(frozen=True)
class Replacement:
    """A legacy image URL, optionally limited to <Card>s whose attributes match."""

    url: str
    match: dict[str, str]  # attribute -> regex


@dataclass(frozen=True)
class Card:
    path: str  # <section>/<key>, the published path without .avif
    spec: dict  # everything that affects pixels
    replaces: tuple[Replacement, ...]

    @property
    def marks(self) -> list[str]:
        return [m for m in (self.spec.get("logo"), self.spec.get("badge")) if m]


def _replacements(items: list, where: str) -> tuple[Replacement, ...]:
    out = []
    for item in items:
        if isinstance(item, str):
            out.append(Replacement(item, {}))
        else:
            extra = set(item) - {"url", *MATCH_KEYS}
            if extra:
                sys.exit(f"cards.toml: {where} has unknown replace fields {sorted(extra)}")
            out.append(Replacement(item["url"], {k: item[k] for k in MATCH_KEYS if k in item}))
    return tuple(out)


def load_cards() -> dict[str, Card]:
    raw = tomllib.loads(MANIFEST.read_text())
    if set(raw) - set(SECTIONS):
        sys.exit(f"cards.toml: unknown sections {sorted(set(raw) - set(SECTIONS))}")
    cards = {}
    for key, entry in raw.get("integrations", {}).items():
        path = f"integrations/{key}"
        entry = dict(entry)
        replaces = _replacements(entry.pop("replaces", []), path)
        logo, badge = entry.pop("logo", None), entry.pop("badge", None)
        if entry or not logo:
            sys.exit(f"cards.toml: {path} takes logo, optional badge and replaces")
        expected = f"{logo}-{badge}" if badge else logo
        if key != expected:
            sys.exit(f"cards.toml: {path} must be named integrations.{expected} for its art")
        spec = {"id": path, "template": "logo", "logo": logo} | ({"badge": badge} if badge else {})
        cards[path] = Card(path, spec, replaces)
    for key, entry in raw.get("topics", {}).items():
        path = f"topics/{key}"
        entry = dict(entry)
        replaces = _replacements(entry.pop("replaces", []), path)
        if entry:
            sys.exit(f"cards.toml: {path} takes only replaces; the key names the motif")
        if key not in design.MOTIFS:
            sys.exit(f"cards.toml: {path}: no motif {key!r} (have {', '.join(design.MOTIFS)})")
        cards[path] = Card(path, {"id": path, "template": "topic", "motif": key}, replaces)
    return cards


def select(cards: dict[str, Card], names: list[str]) -> list[Card]:
    picked = []
    for name in names:
        matches = [c for p, c in cards.items() if name in (p, p.split("/", 1)[1])]
        if len(matches) != 1:
            sys.exit(f"{'ambiguous' if matches else 'unknown'} card {name!r}")
        picked.append(matches[0])
    return picked if names else list(cards.values())


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


# --- Rendering -----------------------------------------------------------------


@functools.cache
def design_digest() -> bytes:
    """card_design.py as code only, so comments, docstrings and formatting
    can change without re-rendering every card."""
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
    return h.hexdigest()[:12]


def url_for(card: Card) -> str:
    return f"{PUBLIC}/{card.path}.avif"


def render(card: Card) -> Path:
    """Render into the cache, keyed by fingerprint, and return the file."""
    leaf = card.path.replace("/", "__")
    path = CACHE / "renders" / f"{leaf}.{fingerprint(card)}.avif"
    if path.exists():
        return path
    svg = design.compose(card.spec, {name: measure(name) for name in card.marks})
    png = resvg_py.svg_to_bytes(svg_string=svg, skip_system_fonts=True)
    img = Image.open(io.BytesIO(bytes(png))).convert("RGB")
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, **ENCODE)
    return path


# --- GCS and MDX ---------------------------------------------------------------


def remote_objects() -> tuple[dict[str, str | None], list[str]]:
    """Card path -> stored fingerprint, plus objects under the prefix that are not cards."""
    proc = subprocess.run(
        ["gcloud", "storage", "objects", "list", f"gs://{BUCKET}/{PREFIX}/**", "--format=json"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        if "matched no objects" in proc.stderr:
            return {}, []
        sys.exit(f"gcloud storage objects list failed:\n{proc.stderr}")
    cards, other = {}, []
    for obj in json.loads(proc.stdout or "[]"):
        rel = obj["name"].removeprefix(f"{PREFIX}/")
        if m := re.fullmatch(rf"((?:{'|'.join(SECTIONS)})/{KEY})\.avif", rel):
            meta = obj.get("custom_fields") or obj.get("metadata") or {}
            cards[m.group(1)] = meta.get("fingerprint")
        else:
            other.append(rel)
    return cards, other


def mdx_files() -> list[Path]:
    return sorted(p for p in DOCS.rglob("*.mdx") if "i18n" not in p.parts)


def card_tags() -> list[tuple[Path, str, dict[str, str]]]:
    """Every <Card img> in the docs as (file, img URL, title/href attributes)."""
    tags = []
    for path in mdx_files():
        for tag in CARD_TAG.finditer(path.read_text()):
            img = IMG_ATTR.search(tag.group(0))
            if img:
                tags.append((path, img.group(1), dict(ATTR.findall(tag.group(0)))))
    return tags


class Ambiguous(Exception):
    pass


def replacement(cards: dict[str, Card], url: str, attrs: dict[str, str]) -> Card | None:
    """The card that replaces a legacy image on a <Card> with these attributes.

    An entry with `title`/`href` patterns beats a plain URL entry. Order in the
    manifest does not matter: if two entries of the same kind match, the
    manifest is ambiguous and nothing is replaced.
    """
    entries = [(c, r) for c in cards.values() for r in c.replaces if r.url == url]
    patterned = {
        c.path: c
        for c, r in entries
        if r.match and all(re.search(rx, attrs.get(k, "")) for k, rx in r.match.items())
    }
    plain = {c.path: c for c, r in entries if not r.match}
    for found in (patterned, plain):
        if len(found) > 1:
            raise Ambiguous(f"{attrs.get('title', url)!r} matches {', '.join(sorted(found))}")
        if found:
            return next(iter(found.values()))
    return None


# --- Commands ------------------------------------------------------------------


def cmd_render(args: argparse.Namespace) -> None:
    cards = select(load_cards(), args.names)
    out = Path(args.out)
    paths = []
    for card in cards:
        path = out / f"{card.path}.avif"
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(render(card), path)
        paths.append((card, path.relative_to(out)))
        print(f"{path.stat().st_size / 1024:6.1f} KB  {path}")
    if args.sheet:
        sheet = out / "sheet.html"
        sheet.write_text(contact_sheet(paths))
        print(f"\nsheet: {sheet}")


def cmd_status(args: argparse.Namespace) -> None:
    cards = load_cards()
    remote, other = remote_objects()
    tags = card_tags()
    used: dict[str, int] = {}
    for _, url, _ in tags:
        if m := MANAGED.fullmatch(url):
            used[m.group(1)] = used.get(m.group(1), 0) + 1
    problems = 0
    print(f"{'card':40} {'gcs':8} {'refs':>4}")
    for card in cards.values():
        if card.path not in remote:
            state = "missing"
        elif remote[card.path] != fingerprint(card):
            state = "changed"
        else:
            state = "current"
        if state != "current" and used.get(card.path):
            problems += 1
        print(f"{card.path:40} {state:8} {used.get(card.path, 0):>4}")
    for path in sorted(set(used) - set(cards)):
        problems += 1
        print(f"  MDX uses unknown card {path!r}")
    legacy: dict[str, int] = {}
    for file, url, attrs in tags:
        if MANAGED.fullmatch(url):
            continue
        legacy[url] = legacy.get(url, 0) + 1
        try:
            replacement(cards, url, attrs)
        except Ambiguous as err:
            problems += 1
            print(f"  ambiguous in {file.relative_to(REPO)}: {err}")
    print(f"\n{sum(legacy.values())} card images across {len(legacy)} URLs are not managed yet.")
    for url, n in sorted(legacy.items(), key=lambda kv: -kv[1])[: args.legacy]:
        print(f"  {n:3}  {url}")
    unused = sorted(set(remote) - set(cards)) + other
    if unused:
        print(f"\n{len(unused)} object(s) under {PREFIX}/ belong to no card, e.g. {unused[0]}")
    if args.check and problems:
        sys.exit(f"\n{problems} problem(s): run `cards.py push`, then `cards.py relink`.")


def cmd_push(args: argparse.Namespace) -> None:
    cards = select(load_cards(), args.names)
    remote, _ = remote_objects()
    new = [c for c in cards if c.path not in remote]
    changed = [c for c in cards if c.path in remote and remote[c.path] != fingerprint(c)]
    if changed and not args.replace:
        print(
            f"{len(changed)} published card(s) changed: {', '.join(c.path for c in changed)}\n"
            "  Replacing them changes live pages. Merge the change first, then run push --replace."
        )
    pending = new + (changed if args.replace else [])
    if not pending:
        print("Nothing to upload.")
        return
    for card in pending:
        verb = "replace" if card in changed else "upload"
        dest = f"gs://{BUCKET}/{PREFIX}/{card.path}.avif"
        if args.dry_run:
            print(f"would {verb} {dest}")
            continue
        subprocess.run(
            [
                "gcloud",
                "storage",
                "cp",
                f"--cache-control={CACHE_CONTROL}",
                "--content-type=image/avif",
                f"--custom-metadata=fingerprint={fingerprint(card)}",
                str(render(card)),
                dest,
            ],
            check=True,
            capture_output=True,
        )
        print(f"{verb.removesuffix('e')}ed {url_for(card)}")


def cmd_relink(args: argparse.Namespace) -> None:
    cards = load_cards()
    scope = {c.path for c in select(cards, args.names)}
    remote, _ = remote_objects()
    missing = sorted(p for p in scope if p not in remote)
    if missing and not args.dry_run:
        # Linking an object that is not uploaded would ship a broken image.
        print(f"skipping {len(missing)} card(s) not in GCS yet (run push): {', '.join(missing)}")
        scope -= set(missing)

    def swap(tag: re.Match[str]) -> str:
        text = tag.group(0)
        img = IMG_ATTR.search(text)
        if not img or MANAGED.fullmatch(img.group(1)):
            return text
        try:
            card = replacement(cards, img.group(1), dict(ATTR.findall(text)))
        except Ambiguous as err:
            print(f"  skipped, ambiguous: {err}")
            return text
        return text.replace(img.group(1), url_for(card)) if card and card.path in scope else text

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
    print(url_for(select(load_cards(), [args.name])[0]))


def platform_icon(name: str) -> bytes:
    """An icon from the Phoenix app (js/app/.../Icons.tsx) as a plain SVG."""
    source = PLATFORM_ICONS.read_text()
    found = re.search(rf"export const {name} = \(\) => \((.*?)\n\);", source, re.S)
    if not found:
        sys.exit(f"no icon named {name!r} in {PLATFORM_ICONS.relative_to(REPO)}")
    svg = re.sub(r"\s+", " ", found.group(1).strip())
    # JSX attribute names to SVG ones: fillRule -> fill-rule.
    svg = re.sub(
        r"\b(?!viewBox)([a-z]+)([A-Z][a-zA-Z]*)=",
        lambda m: m.group(1) + re.sub(r"([A-Z])", r"-\1", m.group(2)).lower() + "=",
        svg,
    )
    return svg.replace("currentColor", "#000").encode()


SVG_NS = "http://www.w3.org/2000/svg"
DROP_TAGS = {"title", "desc", "metadata", "script"}
COLOR = re.compile(
    r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|currentColor|url\(#[^)]*\)|\b(?:white|black)\b"
)


def _ink(svg: bytes, width: int = 1024) -> tuple[Image.Image, tuple[int, int, int, int]]:
    png = resvg_py.svg_to_bytes(svg_string=svg.decode(), width=width, skip_system_fonts=True)
    alpha = Image.open(io.BytesIO(bytes(png))).convert("RGBA").getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        sys.exit("logo renders empty")
    return alpha, bbox


def _same_silhouette(a: bytes, b: bytes) -> float:
    """Share of ink that differs between two SVGs, ignoring sub-pixel shifts.

    Both are cropped to their ink and thresholded; a pixel counts as different
    only if the other drawing has no ink within 2 px of it.
    """

    def mask(svg: bytes) -> Image.Image:
        alpha, bbox = _ink(svg)
        return alpha.crop(bbox).resize((512, 512)).point(lambda v: 255 if v > 127 else 0)

    ma, mb = mask(a), mask(b)
    near_a, near_b = ma.filter(ImageFilter.MaxFilter(5)), mb.filter(ImageFilter.MaxFilter(5))
    stray = ImageChops.subtract(ma, near_b).histogram()[255]
    stray += ImageChops.subtract(mb, near_a).histogram()[255]
    return stray / max(ImageChops.lighter(ma, mb).histogram()[255], 1)


def normalize_svg(data: bytes, note: str) -> bytes:
    """Rewrite a logo SVG into the shape every vendored logo shares.

    One source comment, then a root <svg> with xmlns, a whole-unit viewBox
    tight to the ink, and a width and height equal to it. Editor metadata,
    titles and scripts are dropped, every color becomes solid black (the
    renderer reads only the silhouette) and whitespace is collapsed. If the result
    does not draw the same silhouette, the original is kept.
    """
    out = data
    for _ in range(5):  # tightening can settle over a few rounds; stop at a fixed point
        nxt = _normalize_once(out, note)
        if nxt == out:
            break
        out = nxt
    diff = _same_silhouette(data, out)
    if diff > 0.01:
        print(f"  kept the original: normalizing changed {diff:.1%} of the silhouette")
        return f"<!-- {note} -->\n".encode() + re.sub(rb"<!--.*?-->\n?", b"", data, flags=re.S)
    return out


def _normalize_once(data: bytes, note: str) -> bytes:
    ET.register_namespace("", SVG_NS)
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    root = ET.fromstring(re.sub(rb"<!--.*?-->", b"", data, flags=re.S))
    for parent in list(root.iter()):
        for child in list(parent):
            tag = child.tag.split("}")[-1] if isinstance(child.tag, str) else ""
            if tag in DROP_TAGS or (isinstance(child.tag, str) and SVG_NS not in child.tag):
                parent.remove(child)
    for el in root.iter():
        for key in list(el.attrib):
            if "}" in key and "xlink" not in key:
                del el.attrib[key]  # sodipodi:, inkscape: and similar
            elif key in ("opacity", "fill-opacity", "stroke-opacity", "stop-opacity"):
                del el.attrib[key]  # a mark is one solid silhouette
            elif key in ("fill", "stroke", "stop-color", "color") or key == "style":
                value = COLOR.sub("#000", el.attrib[key])
                el.attrib[key] = re.sub(
                    r"(?:^|;)\s*(?:fill-|stroke-|stop-)?opacity:[^;]*", "", value
                )
        if el.text and not el.text.strip():
            el.text = None
        if el.tail and not el.tail.strip():
            el.tail = None
    if "viewBox" not in root.attrib:
        w = float(re.sub(r"[^0-9.]", "", root.attrib.get("width", "24")))
        h = float(re.sub(r"[^0-9.]", "", root.attrib.get("height", "24")))
        root.attrib["viewBox"] = f"0 0 {w:g} {h:g}"
    for key in (
        "width",
        "height",
        "x",
        "y",
        "version",
        "id",
        "class",
        "style",
        "enable-background",
    ):
        root.attrib.pop(key, None)
    body = ET.tostring(root, encoding="unicode")
    # Tighten the viewBox to the ink in whole units, rounding outward so nothing
    # clips. Whole units matter: the renderer rounds a fractional intrinsic size
    # to whole pixels and letterboxes the drawing, showing ink the box clips.
    vx, vy, vw, vh = (float(v) for v in re.split(r"[\s,]+", root.attrib["viewBox"].strip()))
    alpha, (x0, y0, x1, y1) = _ink(body.encode())
    sx, sy = vw / alpha.width, vh / alpha.height
    # Ink edges in user units, measured one pixel inside the anti-aliased edge.
    ink = (vx + (x0 + 1) * sx, vy + (y0 + 1) * sy, vx + (x1 - 1) * sx, vy + (y1 - 1) * sy)
    box = (vx, vy, vx + vw, vy + vh)
    whole = all(float(v).is_integer() for v in box)
    # Slack allowed on each side: one unit, or two rendered pixels when a pixel
    # spans more than a unit.
    tx, ty = max(1.0, 2 * sx), max(1.0, 2 * sy)
    within = box[0] - tx < ink[0] < box[0] + tx and box[1] - ty < ink[1] < box[1] + ty
    within = within and box[2] - tx < ink[2] < box[2] + tx and box[3] - ty < ink[3] < box[3] + ty
    if not (whole and within):  # an already tight whole-unit box stays as it is
        left, top = math.floor(ink[0]), math.floor(ink[1])
        right, bottom = math.ceil(ink[2]), math.ceil(ink[3])
        root.attrib["viewBox"] = f"{left} {top} {right - left} {bottom - top}"
    _, _, box_w, box_h = re.split(r"[\s,]+", root.attrib["viewBox"].strip())
    root.attrib["width"], root.attrib["height"] = box_w, box_h
    out = f"<!-- {note} -->\n{ET.tostring(root, encoding='unicode')}\n".encode()
    return out


def source_note(path: Path) -> str:
    first = path.read_text().split("\n", 1)[0]
    found = re.fullmatch(r"<!-- (.*) -->", first.strip())
    return found.group(1) if found else f"source: {path.name}"


def cmd_normalize(args: argparse.Namespace) -> None:
    names = args.names or sorted(p.stem for p in LOGOS.glob("*.svg"))
    for name in names:
        path = LOGOS / f"{name}.svg"
        before = path.read_bytes()
        after = normalize_svg(before, source_note(path))
        if after != before:
            path.write_bytes(after)
        print(f"{'normalized' if after != before else 'unchanged '}  {path.relative_to(REPO)}")


def cmd_logo(args: argparse.Namespace) -> None:
    kind, _, ref = args.source.partition(":")
    if kind == "platform":
        note = f"source: {PLATFORM_ICONS.relative_to(REPO)} {ref}"
        data = platform_icon(ref)
    elif kind in SOURCES:
        url = SOURCES[kind].format(ref)
        note = f"source: {url} ({LICENSES[kind]})"
        data = fetch(url)
    elif args.source.startswith("https://"):
        note, data = f"source: {args.source}", fetch(args.source)
    else:
        path = Path(args.source)
        note, data = f"source: {path.name}", path.read_bytes()
    suffix = ".png" if data[:8] == b"\x89PNG\r\n\x1a\n" else ".svg"
    dest = LOGOS / f"{args.name}{suffix}"
    dest.write_bytes(normalize_svg(data, note) if suffix == ".svg" else data)
    mark = measure(args.name)
    print(f"wrote {dest.relative_to(REPO)} (ink density {mark.density:.2f})")


def contact_sheet(paths: list[tuple[Card, Path]]) -> str:
    """Review page: every render at 4-column and 2-column docs widths, on both docs themes."""

    def grid(cols: int, width: int) -> str:
        items = "".join(
            f'<figure><img src="{p}" alt=""><figcaption>{c.path}</figcaption></figure>'
            for c, p in paths
        )
        return f'<h2>{cols} columns · {width}px cards</h2><div class="g{cols}">{items}</div>'

    grids = grid(4, 158) + grid(2, 334)
    return f"""<!doctype html><meta charset="utf-8"><title>Card sheet</title>
<style>
body{{margin:0;font:14px system-ui}}
section{{padding:24px 32px 40px}}
.dark{{background:#08090A;color:#D5D7DB;--card:#151616;--line:rgba(194,196,234,.2);--title:#fff}}
.light{{background:#fff;color:#2B2D31;--card:#F7F7F8;--line:rgba(8,9,10,.18);--title:#08090A}}
h1{{font-size:13px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;margin:0}}
h2{{font-weight:600;font-size:15px;margin:28px 0 12px}}
.g4,.g2{{display:grid;gap:16px}}.g4{{grid-template-columns:repeat(auto-fill,158px)}}
.g2{{grid-template-columns:repeat(auto-fill,334px)}}
figure{{margin:0;background:var(--card);border:1px solid var(--line);border-radius:16px;
overflow:hidden}}img{{display:block;width:100%}}
figcaption{{padding:12px 14px;font-weight:600;color:var(--title);overflow-wrap:anywhere}}
</style>
<section class="dark"><h1>Docs dark theme</h1>{grids}</section>
<section class="light"><h1>Docs light theme</h1>{grids}</section>"""


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("render", help="render cards locally")
    p.add_argument("names", nargs="*")
    p.add_argument("--out", default=str(CACHE / "out"))
    p.add_argument("--sheet", action="store_true", help="also write a review page")
    p.set_defaults(func=cmd_render)

    p = sub.add_parser("status", help="report drift between manifest, GCS and MDX")
    p.add_argument("--check", action="store_true", help="exit 1 on drift")
    p.add_argument("--legacy", type=int, default=15, help="unmanaged URLs to list")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("push", help="upload new cards to GCS")
    p.add_argument("names", nargs="*")
    p.add_argument("--replace", action="store_true", help="also replace changed cards")
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(func=cmd_push)

    p = sub.add_parser("relink", help="swap legacy <Card img> URLs for managed cards")
    p.add_argument("names", nargs="*")
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(func=cmd_relink)

    p = sub.add_parser("url", help="print the public URL of a card")
    p.add_argument("name")
    p.set_defaults(func=cmd_url)

    p = sub.add_parser("logo", help="vendor a monochrome logo into assets/cards/logos")
    p.add_argument("name")
    p.add_argument(
        "source", help="platform:<Icon>, lobehub:<icon>, simple:<icon>, devicon:<path>, URL, path"
    )
    p.set_defaults(func=cmd_logo)

    p = sub.add_parser("normalize", help="rewrite vendored SVG logos into the shared shape")
    p.add_argument("names", nargs="*")
    p.set_defaults(func=cmd_normalize)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
