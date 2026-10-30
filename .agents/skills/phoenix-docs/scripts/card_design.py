"""Card art templates for Phoenix docs.

Pure functions: a card spec and its resolved assets in, an SVG document out.
`cards.py` hashes this file into every card fingerprint, so any edit here
re-renders every card. Keep I/O and CLI code out of this module.

Every template shares one canvas, one background and one ink color. Content
stays inside SAFE so a card survives a future switch to fixed-height crops.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from html import escape

W, H = 1200, 675
SAFE = 80

BG_TOP = "#101317"
BG_BOTTOM = "#090A0C"
INK = "#F4F5F7"
MUTED = "#C2C4EA"  # drawn at low opacity for hairlines and placeholder text
PANEL = "#14171A"
RAISED = "#1A1D21"

# Product-area accents, tuned to sit at similar lightness on the dark canvas.
# Each pair is (bright, deep): bright for marks, deep for glows.
ACCENTS: dict[str, tuple[str, str]] = {
    "cyan": ("#39C7FF", "#009DD2"),
    "green": ("#5EE0A8", "#12A26B"),
    "violet": ("#B4A6FF", "#6E5BFF"),
    "amber": ("#FFC46B", "#E08A00"),
    "rose": ("#FF8FAB", "#E0406A"),
}

MOTIF_ACCENTS = {
    "trace": "cyan",
    "agent": "cyan",
    "eval": "green",
    "prompt": "violet",
    "dataset": "amber",
    "experiment": "rose",
    "retrieval": "amber",
}


@dataclass(frozen=True)
class Mark:
    """A monochrome logo or glyph, measured by the caller."""

    href: str  # data URI of the source image
    aspect: float  # intrinsic height / width of the source image
    bbox: tuple[float, float, float, float]  # visible ink as fractions (x0, y0, x1, y1)
    density: float  # share of the ink bbox that is opaque


@dataclass(frozen=True)
class Shot:
    """A raster screenshot for the frame template."""

    href: str
    width: int
    height: int


def el(tag: str, *children: str, **attrs: object) -> str:
    """Build one SVG element. `stroke_width=2` becomes `stroke-width="2"`."""
    parts = []
    for key, value in attrs.items():
        if value is None:
            continue
        if isinstance(value, float):
            value = f"{value:.2f}".rstrip("0").rstrip(".")
        parts.append(f'{key.rstrip("_").replace("_", "-")}="{escape(str(value))}"')
    head = f"<{tag} {' '.join(parts)}" if parts else f"<{tag}"
    return f"{head}>{''.join(children)}</{tag}>" if children else f"{head}/>"


def compose(card: dict, marks: dict[str, Mark], shot: Shot | None = None) -> str:
    """Return the SVG document for one card spec."""
    template = card.get("template", "logo")
    seed = card["id"]
    if template == "logo":
        accent = card.get("accent", "cyan")
        body = _logo_body(marks[card["logo"]], accent)
    elif template == "topic":
        motif = card["motif"]
        accent = card.get("accent", MOTIF_ACCENTS[motif])
        body = MOTIFS[motif](accent)
    elif template == "frame":
        if shot is None:
            raise ValueError(f"{seed}: frame template needs a screenshot")
        accent = card.get("accent", "cyan")
        body = _frame_body(shot, accent)
    else:
        raise ValueError(f"{seed}: unknown template {template!r}")
    if accent not in ACCENTS:
        raise ValueError(f"{seed}: unknown accent {accent!r}")

    badges = [marks[name] for name in card.get("badges", [])]
    if len(badges) > 2:
        raise ValueError(f"{seed}: at most two badges")
    rails = _rails(seed, accent) if template == "logo" else ""
    return el(
        "svg",
        _defs(accent),
        _background(),
        rails,
        body,
        *(_badge(mark, len(badges) - 1 - i) for i, mark in enumerate(badges)),
        xmlns="http://www.w3.org/2000/svg",
        width=W,
        height=H,
        viewBox=f"0 0 {W} {H}",
    )


# --- Shared layers -------------------------------------------------------------


def _stops(*stops: tuple[float, str, float]) -> str:
    return "".join(el("stop", offset=o, stop_color=c, stop_opacity=a) for o, c, a in stops)


def _defs(accent: str) -> str:
    bright, deep = ACCENTS[accent]
    full = {"width": W, "height": H}
    return el(
        "defs",
        el(
            "linearGradient",
            _stops((0, BG_TOP, 1), (1, BG_BOTTOM, 1)),
            id="bg",
            x1=0,
            y1=0,
            x2=0,
            y2=1,
        ),
        el(
            "radialGradient",
            _stops((0, deep, 0.34), (0.55, deep, 0.10), (1, deep, 0)),
            id="glow",
            cx=0.5,
            cy=0.46,
            r=0.5,
        ),
        el(
            "radialGradient",
            _stops((0, bright, 0.16), (1, bright, 0)),
            id="rim",
            cx=0.5,
            cy=0,
            r=0.75,
        ),
        el(
            "radialGradient",
            _stops((0, "#fff", 0.2), (0.45, "#fff", 1), (1, "#fff", 0)),
            id="fade",
            cx=0.5,
            cy=0.46,
            r=0.62,
        ),
        el("mask", el("rect", **full, fill="url(#fade)"), id="gridmask"),
        el(
            "pattern",
            el("circle", cx=15, cy=15, r=1.6, fill=MUTED),
            id="dots",
            width=30,
            height=30,
            patternUnits="userSpaceOnUse",
        ),
        # Recolors any mark to the ink color while keeping its alpha.
        el(
            "filter",
            el("feFlood", flood_color=INK),
            el("feComposite", in2="SourceAlpha", operator="in"),
            id="ink",
            color_interpolation_filters="sRGB",
        ),
        el(
            "filter",
            el("feFlood", flood_color=bright),
            el("feComposite", in2="SourceAlpha", operator="in"),
            el("feGaussianBlur", stdDeviation=38),
            id="halo",
            x="-50%",
            y="-50%",
            width="200%",
            height="200%",
            color_interpolation_filters="sRGB",
        ),
        el(
            "filter",
            el("feGaussianBlur", stdDeviation=28),
            id="soft",
            x="-20%",
            y="-20%",
            width="140%",
            height="140%",
        ),
    )


def _background() -> str:
    full = {"width": W, "height": H}
    return (
        el("rect", **full, fill="url(#bg)")
        + el("rect", **full, fill="url(#glow)")
        + el("rect", **full, fill="url(#rim)")
        + el("rect", **full, fill="url(#dots)", opacity=0.3, mask="url(#gridmask)")
    )


def _rails(seed: str, accent: str) -> str:
    """Faint trace spans along the bottom edge.

    Seeded by the card id, so every card gets its own pattern and re-renders
    reproduce it exactly.
    """
    rng = random.Random(seed)
    bright, _ = ACCENTS[accent]
    spans = []
    for i, y in enumerate((H - 150, H - 112, H - 74)):
        x = rng.randint(-40, 140) + i * rng.randint(30, 90)
        while x < W:
            length = rng.randint(90, 360)
            hot = rng.random() < 0.18
            spans.append(
                el(
                    "rect",
                    x=x,
                    y=y,
                    width=length,
                    height=12,
                    rx=6,
                    fill=bright if hot else MUTED,
                    opacity=0.42 if hot else rng.choice((0.08, 0.11, 0.14)),
                )
            )
            x += length + rng.randint(24, 180)
    edge_fade = el(
        "linearGradient",
        _stops((0, "#fff", 0), (0.2, "#fff", 1), (0.8, "#fff", 1), (1, "#fff", 0)),
        id="railfade",
        x1=0,
        y1=0,
        x2=1,
        y2=0,
    )
    mask = el("mask", el("rect", width=W, height=H, fill="url(#railfade)"), id="railmask")
    return el("defs", edge_fade, mask) + el("g", *spans, mask="url(#railmask)")


def _place(
    mark: Mark, cx: float, cy: float, box_w: float, box_h: float, area: float
) -> tuple[float, float, float, float]:
    """Size a mark by visual area, capped by a box, and centre its ink on (cx, cy).

    Returns x, y, width, height for an <image> holding the full source, so the
    ink — not the source's padding — lands where the layout wants it.
    """
    x0, y0, x1, y1 = mark.bbox
    ink_w = x1 - x0
    ink_h = (y1 - y0) * mark.aspect
    ratio = ink_w / ink_h
    w = math.sqrt(area * ratio)
    # Thin or outlined marks read lighter than solid ones; nudge them up a little.
    w *= min(max((0.5 / max(mark.density, 0.05)) ** 0.18, 0.92), 1.15)
    h = w / ratio
    if h > box_h:
        w, h = box_h * ratio, box_h
    if w > box_w:
        w, h = box_w, box_w / ratio
    img_w = w / ink_w
    img_h = img_w * mark.aspect
    return cx - w / 2 - x0 * img_w, cy - h / 2 - y0 * img_h, img_w, img_h


def _image(mark: Mark, box: tuple[float, float, float, float], filt: str, opacity=1.0) -> str:
    x, y, w, h = box
    return el(
        "image",
        x=x,
        y=y,
        width=w,
        height=h,
        filter=f"url(#{filt})",
        opacity=opacity,
        href=mark.href,
    )


def _badge(mark: Mark, slot: int) -> str:
    """Corner tile naming a language or capability, for sibling cards that share a logo.

    Slot 0 sits in the bottom-right corner; slot 1 sits to its left, so a
    list of badges reads left to right.
    """
    size, gap = 136, 20
    x, y = W - SAFE - size - slot * (size + gap), H - SAFE - size
    box = _place(mark, x + size / 2, y + size / 2, 70, 70, 70 * 70 * 0.78)
    return (
        el("rect", x=x, y=y, width=size, height=size, rx=34, fill="#151719")
        + el(
            "rect",
            x=x + 1,
            y=y + 1,
            width=size - 2,
            height=size - 2,
            rx=33,
            fill="none",
            stroke=MUTED,
            stroke_opacity=0.22,
            stroke_width=2,
        )
        + _image(mark, box, "ink", 0.94)
    )


# --- Templates -------------------------------------------------------------------


def _logo_body(mark: Mark, accent: str) -> str:
    cx, cy = W / 2, H * 0.44
    box = _place(mark, cx, cy, W * 0.5, H * 0.38, W * H * 0.085)
    return (
        el(
            "ellipse",
            cx=cx,
            cy=cy,
            rx=300,
            ry=170,
            fill=ACCENTS[accent][1],
            opacity=0.22,
            filter="url(#soft)",
        )
        + _image(mark, box, "halo", 0.36)
        + _image(mark, box, "ink")
    )


def _frame_body(shot: Shot, accent: str) -> str:
    """A product screenshot in a window, bleeding off the bottom edge."""
    fx, fy, fw = 150, 92, W - 300
    fh = H - fy + 40
    bar = 46
    window = {"x": fx, "y": fy, "width": fw, "height": fh}
    dots = "".join(
        el("circle", cx=fx + 28 + i * 22, cy=fy + bar / 2, r=6, fill=MUTED, opacity=0.28)
        for i in range(3)
    )
    return (
        el(
            "rect",
            x=fx - 40,
            y=fy + 40,
            width=fw + 80,
            height=fh,
            rx=40,
            fill=ACCENTS[accent][1],
            opacity=0.30,
            filter="url(#soft)",
        )
        + el("clipPath", el("rect", **window, rx=22), id="win")
        + el(
            "g",
            el("rect", **window, fill=PANEL),
            el("rect", x=fx, y=fy, width=fw, height=bar, fill=RAISED),
            dots,
            el(
                "image",
                x=fx,
                y=fy + bar,
                width=fw,
                height=fw * shot.height / shot.width,
                preserveAspectRatio="xMidYMin slice",
                href=shot.href,
            ),
            clip_path="url(#win)",
        )
        + el(
            "rect",
            x=fx + 1,
            y=fy + 1,
            width=fw - 2,
            height=fh,
            rx=21,
            fill="none",
            stroke=MUTED,
            stroke_opacity=0.24,
            stroke_width=2,
        )
    )


# --- Topic motifs ----------------------------------------------------------------
# Each motif is a small product illustration on a shared panel. Strokes stay at
# 3px or more and features at 12px or more so they survive the 4-column grid.

PX, PY, PW, PH = 270, 130, 660, 400


def _panel() -> str:
    return (
        el(
            "rect",
            x=PX - 30,
            y=PY + 30,
            width=PW + 60,
            height=PH,
            rx=40,
            fill="#000",
            opacity=0.5,
            filter="url(#soft)",
        )
        + el("rect", x=PX, y=PY, width=PW, height=PH, rx=26, fill=PANEL)
        + el(
            "rect",
            x=PX + 1,
            y=PY + 1,
            width=PW - 2,
            height=PH - 2,
            rx=25,
            fill="none",
            stroke=MUTED,
            stroke_opacity=0.22,
            stroke_width=2,
        )
    )


def _bar(x: float, y: float, w: float, h: float = 14, fill=MUTED, opacity=0.22) -> str:
    """A rounded bar standing in for a line of text or a span."""
    return el("rect", x=x, y=y, width=w, height=h, rx=h / 2, fill=fill, opacity=opacity)


def _line(x1: float, y1: float, x2: float, y2: float, opacity: float, width=2) -> str:
    return el(
        "line",
        x1=x1,
        y1=y1,
        x2=x2,
        y2=y2,
        stroke=MUTED,
        stroke_opacity=opacity,
        stroke_width=width,
    )


def _trace(accent: str) -> str:
    """Span waterfall: a tree of spans against a shared timeline."""
    bright, _ = ACCENTS[accent]
    rows = [  # depth, start, end (fractions of the timeline), highlighted
        (0, 0.00, 1.00, True),
        (1, 0.02, 0.38, False),
        (2, 0.05, 0.26, False),
        (1, 0.40, 0.94, True),
        (2, 0.42, 0.66, False),
        (2, 0.68, 0.90, False),
    ]
    tx0, tx1 = PX + 250, PX + PW - 40
    top, step = PY + 62, 56
    out = [_panel()]
    for i in range(1, 5):
        x = tx0 + (tx1 - tx0) * i / 4
        out.append(_line(x, PY + 30, x, PY + PH - 30, 0.08))
    for i, (depth, a, b, hot) in enumerate(rows):
        y = top + i * step
        lx = PX + 44 + depth * 34
        if depth:
            out.append(
                el(
                    "path",
                    d=f"M{lx - 22} {y - step + 12} V{y + 1} H{lx - 6}",
                    fill="none",
                    stroke=MUTED,
                    stroke_opacity=0.22,
                    stroke_width=3,
                    stroke_linejoin="round",
                )
            )
        out.append(
            el(
                "circle",
                cx=lx + 7,
                cy=y + 1,
                r=7,
                fill=bright if hot else MUTED,
                opacity=0.95 if hot else 0.35,
            )
        )
        out.append(_bar(lx + 24, y - 6, 140 - depth * 34, 12, MUTED, 0.26))
        span_x = tx0 + (tx1 - tx0) * a
        out.append(_bar(span_x, y - 9, (tx1 - tx0) * (b - a), 20, bright, 0.9 if hot else 0.32))
    return "".join(out)


def _eval(accent: str) -> str:
    """Scorecard: a score ring beside labelled pass and fail results."""
    bright, _ = ACCENTS[accent]
    fail = ACCENTS["rose"][0]
    cx, cy, r = PX + 150, PY + PH / 2, 86
    circ = 2 * math.pi * r
    ring = {"cx": cx, "cy": cy, "r": r, "fill": "none", "stroke_width": 22}
    out = [
        _panel(),
        el("circle", **ring, stroke=MUTED, stroke_opacity=0.14),
        el(
            "circle",
            **ring,
            stroke=bright,
            stroke_linecap="round",
            stroke_dasharray=f"{circ * 0.82:.1f} {circ:.1f}",
            transform=f"rotate(-90 {cx} {cy})",
        ),
    ]
    x0, top, step = PX + 300, PY + 70, 76
    for i, ok in enumerate((True, True, False, True)):
        y = top + i * step
        color = bright if ok else fail
        px = PX + PW - 150
        mark = (
            f"M{px + 38} {y} l10 10 l19 -20"
            if ok
            else (f"M{px + 41} {y - 11} l22 22 M{px + 63} {y - 11} l-22 22")
        )
        out.append(_bar(x0, y - 7, 150 - (i % 2) * 40, 14, MUTED, 0.3))
        out.append(
            el("rect", x=px, y=y - 22, width=104, height=44, rx=22, fill=color, opacity=0.16)
        )
        out.append(
            el(
                "path",
                d=mark,
                fill="none",
                stroke=color,
                stroke_width=6,
                stroke_linecap="round",
                stroke_linejoin="round",
            )
        )
    return "".join(out)


def _dataset(accent: str) -> str:
    """Table: a header row and examples, one row selected."""
    bright, _ = ACCENTS[accent]
    rng = random.Random("dataset")
    cols = [(PX + 40, 100), (PX + 190, 150), (PX + 380, 100), (PX + 520, 90)]
    out = [
        _panel(),
        el("rect", x=PX, y=PY, width=PW, height=70, rx=26, fill=bright, opacity=0.10),
        el("rect", x=PX, y=PY + 44, width=PW, height=26, fill=PANEL),
    ]
    out += [_bar(x, PY + 28, w * 0.7, 14, bright, 0.75) for x, w in cols]
    for r in range(5):
        y = PY + 104 + r * 60
        selected = r == 2
        if selected:
            out.append(
                el(
                    "rect",
                    x=PX + 16,
                    y=y - 22,
                    width=PW - 32,
                    height=52,
                    rx=14,
                    fill=bright,
                    opacity=0.14,
                )
            )
        out.append(_line(PX + 24, y + 30, PX + PW - 24, y + 30, 0.10))
        for x, w in cols:
            fill, opacity = (INK, 0.6) if selected else (MUTED, 0.24)
            out.append(_bar(x, y - 3, w * rng.uniform(0.45, 1.0), 12, fill, opacity))
    return "".join(out)


def _prompt(accent: str) -> str:
    """Prompt editor: role chips, text lines and a template variable."""
    bright, _ = ACCENTS[accent]
    x0 = PX + 44

    def chip(y: float) -> str:
        return el("rect", x=x0, y=y, width=110, height=34, rx=17, fill=MUTED, opacity=0.14) + _bar(
            x0 + 22, y + 11, 66, 12, MUTED, 0.5
        )

    out = [_panel(), chip(PY + 40)]
    out += [_bar(x0, PY + 104 + i * 38, w, 14, MUTED, 0.26) for i, w in enumerate((460, 380, 520))]
    y = PY + 228
    out.append(chip(y))
    vy = y + 66  # the line holding the variable
    vx = x0 + 168
    out += [
        _bar(x0, vy, 150, 14, MUTED, 0.26),
        el("rect", x=vx, y=vy - 15, width=200, height=44, rx=12, fill=bright, opacity=0.18),
        el(
            "rect",
            x=vx + 1,
            y=vy - 14,
            width=198,
            height=42,
            rx=11,
            fill="none",
            stroke=bright,
            stroke_opacity=0.7,
            stroke_width=2,
        ),
        _bar(vx + 46, vy, 108, 14, bright, 0.85),
        _bar(x0 + 386, vy, 120, 14, MUTED, 0.26),
        _bar(x0, vy + 40, 300, 14, MUTED, 0.26),
        el("rect", x=x0 + 316, y=vy + 34, width=5, height=26, rx=2, fill=bright),
    ]
    return "".join(out)


def _experiment(accent: str) -> str:
    """Comparison chart: baseline against candidate across examples."""
    bright, _ = ACCENTS[accent]
    base = PY + PH - 60
    out = [_panel()]
    out += [
        _line(PX + 50, base - i * 80, PX + PW - 50, base - i * 80, 0.22 if i == 0 else 0.08)
        for i in range(4)
    ]
    pairs = [(0.42, 0.64), (0.55, 0.78), (0.36, 0.52), (0.6, 0.88), (0.48, 0.7)]
    gw = (PW - 160) / len(pairs)
    for i, (a, b) in enumerate(pairs):
        x = PX + 90 + i * gw
        out.append(
            el(
                "rect",
                x=x,
                y=base - a * 260,
                width=36,
                height=a * 260,
                rx=8,
                fill=MUTED,
                opacity=0.28,
            )
        )
        out.append(
            el(
                "rect",
                x=x + 44,
                y=base - b * 260,
                width=36,
                height=b * 260,
                rx=8,
                fill=bright,
                opacity=0.92,
            )
        )
    return "".join(out)


def _agent(accent: str) -> str:
    """Agent graph: a planner node routing to tools, one route active."""
    bright, _ = ACCENTS[accent]
    cx, cy = W / 2, PY + PH / 2
    nodes = [(cx - 230, cy - 110), (cx + 230, cy - 110), (cx - 230, cy + 110), (cx + 230, cy + 110)]
    edges, boxes = [], []
    for i, (nx, ny) in enumerate(nodes):
        hot = i == 1
        color = bright if hot else MUTED
        mx = (cx + nx) / 2
        edges.append(
            el(
                "path",
                d=f"M{cx} {cy} C{mx} {cy} {mx} {ny} {nx} {ny}",
                fill="none",
                stroke=color,
                stroke_opacity=0.85 if hot else 0.26,
                stroke_width=5,
                stroke_dasharray=None if hot else "2 12",
                stroke_linecap="round",
            )
        )
        boxes.append(el("rect", x=nx - 62, y=ny - 34, width=124, height=68, rx=18, fill=RAISED))
        boxes.append(
            el(
                "rect",
                x=nx - 61,
                y=ny - 33,
                width=122,
                height=66,
                rx=17,
                fill="none",
                stroke=color,
                stroke_opacity=0.9 if hot else 0.26,
                stroke_width=3,
            )
        )
        boxes.append(_bar(nx - 34, ny - 6, 68, 12, color, 0.85 if hot else 0.34))
    hub = (
        el("circle", cx=cx, cy=cy, r=60, fill=bright, opacity=0.14)
        + el("circle", cx=cx, cy=cy, r=44, fill=RAISED, stroke=bright, stroke_width=5)
        + el("circle", cx=cx, cy=cy, r=14, fill=bright)
    )
    return _panel() + "".join(edges) + "".join(boxes) + hub


def _retrieval(accent: str) -> str:
    """Retrieval: a query over ranked documents with relevance scores."""
    bright, _ = ACCENTS[accent]
    x0 = PX + 40
    out = [
        _panel(),
        el("rect", x=x0, y=PY + 34, width=PW - 80, height=56, rx=28, fill=RAISED),
        el("circle", cx=x0 + 34, cy=PY + 60, r=11, fill="none", stroke=bright, stroke_width=4),
        el(
            "path",
            d=f"M{x0 + 42} {PY + 68} l10 10",
            stroke=bright,
            stroke_width=4,
            stroke_linecap="round",
        ),
        _bar(x0 + 66, PY + 55, 260, 12, bright, 0.8),
    ]
    for i, score in enumerate((0.92, 0.71, 0.48, 0.3)):
        y = PY + 126 + i * 66
        hot = i == 0
        if hot:
            out.append(
                el(
                    "rect",
                    x=x0 - 16,
                    y=y - 14,
                    width=PW - 48,
                    height=58,
                    rx=14,
                    fill=bright,
                    opacity=0.12,
                )
            )
        out.append(
            el(
                "path",
                d=f"M{x0} {y - 2} h22 l10 10 v24 h-32 z",
                fill="none",
                stroke=bright if hot else MUTED,
                stroke_opacity=0.9 if hot else 0.4,
                stroke_width=3,
                stroke_linejoin="round",
            )
        )
        title, opacity = (INK, 0.6) if hot else (MUTED, 0.26)
        out.append(_bar(x0 + 54, y + 2, 250 - i * 30, 12, title, opacity))
        out.append(_bar(x0 + 54, y + 22, 170 - i * 20, 10, MUTED, 0.18))
        meter = PX + PW - 210
        out.append(_bar(meter, y + 10, 150, 12, MUTED, 0.14))
        out.append(_bar(meter, y + 10, 150 * score, 12, bright, 0.9 if hot else 0.45))
    return "".join(out)


MOTIFS = {
    "trace": _trace,
    "eval": _eval,
    "dataset": _dataset,
    "prompt": _prompt,
    "experiment": _experiment,
    "agent": _agent,
    "retrieval": _retrieval,
}
