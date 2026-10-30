"""Card art templates for Phoenix docs.

Pure functions: a card spec and its resolved marks in, an SVG document out.
`cards.py` fingerprints this module's code (not its comments or formatting),
so a visual change here re-renders every card. Keep I/O and CLI code out.

The look is flat and nearly black and white, built only from the docs'
neutral ramp in docs/style.css. The ground is the dark card body color, so in
dark mode a logo appears to sit on the card itself; in light mode the art reads
as a dark panel. Cyan appears only as the one focal element of a motif.

references/card-design.md describes this design in plain English. Change
the two together.

Scale: 1200 canvas px render at 158 CSS px in a 4-column grid (x0.13) and
334 CSS px in a 2-column grid (x0.28). Strokes stay at 6px or more and
features at 28px or more so they survive the smaller size.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from html import escape

W, H = 1200, 675
CX, CY = W / 2, 324  # optical centre, a little above the geometric one

# The docs' neutral ramp (docs/style.css) and its one accent.
GROUND = "#151616"  # gray-900, the dark card body
INK = "#F7F7F8"  # gray-50, logos and primary shapes
SECONDARY = "#A1A4AB"  # gray-400, secondary shapes
GUIDE = "#565A62"  # gray-600, edges, rules and tracks
RAISED = "#2B2D31"  # gray-800, header bands
FOCAL = "#39C7FF"  # the docs' dark-mode accent


@dataclass(frozen=True)
class Mark:
    """A monochrome logo or glyph, measured by the caller."""

    href: str  # data URI of the source image
    aspect: float  # intrinsic height / width of the source image
    bbox: tuple[float, float, float, float]  # visible ink as fractions (x0, y0, x1, y1)
    density: float  # share of the ink bbox that is opaque


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


def compose(card: dict, marks: dict[str, Mark]) -> str:
    """Return the SVG document for one card spec."""
    template = card.get("template", "logo")
    seed = card["id"]
    badge = card.get("badge")
    if template == "logo":
        body = _logo_body(marks[card["logo"]], marks[badge] if badge else None)
    elif template == "topic":
        if badge:
            raise ValueError(f"{seed}: badges belong to logo cards")
        body = MOTIFS[card["motif"]]()
    else:
        raise ValueError(f"{seed}: unknown template {template!r}")
    return el(
        "svg",
        el("defs", _recolor("ink", INK)),
        el("rect", width=W, height=H, fill=GROUND),
        body,
        xmlns="http://www.w3.org/2000/svg",
        width=W,
        height=H,
        viewBox=f"0 0 {W} {H}",
    )


# --- Marks -----------------------------------------------------------------------


def _recolor(name: str, color: str) -> str:
    """A filter that paints any mark in one color while keeping its alpha."""
    return el(
        "filter",
        el("feFlood", flood_color=color),
        el("feComposite", in2="SourceAlpha", operator="in"),
        id=name,
        color_interpolation_filters="sRGB",
    )


def _ratio(mark: Mark) -> float:
    x0, y0, x1, y1 = mark.bbox
    return (x1 - x0) / ((y1 - y0) * mark.aspect)


def _fit(mark: Mark, box_w: float, box_h: float, area: float) -> tuple[float, float]:
    """Size a mark's ink by visual area, capped by a box."""
    ratio = _ratio(mark)
    w = math.sqrt(area * ratio)
    # Thin or outlined marks read lighter than solid ones; nudge them up a little.
    w *= min(max((0.5 / max(mark.density, 0.05)) ** 0.3, 0.92), 1.25)
    h = w / ratio
    if h > box_h:
        w, h = box_h * ratio, box_h
    if w > box_w:
        w, h = box_w, box_w / ratio
    return w, h


def _draw(mark: Mark, cx: float, cy: float, w: float, h: float) -> str:
    """Draw a mark so its ink, not its source padding, is w x h centred on (cx, cy)."""
    x0, y0, x1, _ = mark.bbox
    img_w = w / (x1 - x0)
    img_h = img_w * mark.aspect
    return el(
        "image",
        x=cx - w / 2 - x0 * img_w,
        y=cy - h / 2 - y0 * img_h,
        width=img_w,
        height=img_h,
        filter="url(#ink)",
        href=mark.href,
    )


# --- Logo cards ------------------------------------------------------------------


def _logo_body(logo: Mark, qualifier: Mark | None) -> str:
    """The brand mark alone, or locked up with a qualifier of the same height.

    The lockup reads left to right: brand, divider, qualifier (a language or a
    Phoenix capability), all in the same light ink and centred as one group.
    """
    if qualifier is None:
        w, h = _fit(logo, W * 0.46, H * 0.40, W * H * 0.07)
        return _draw(logo, CX, CY, w, h)
    lw, lh = _fit(logo, W * 0.32, H * 0.27, W * H * 0.04)
    # The qualifier takes the brand's height; only very wide marks shrink.
    qh = min(lh, W * 0.26 / _ratio(qualifier))
    qw = qh * _ratio(qualifier)
    gap, rule = 60, 4
    left = CX - (lw + gap + rule + gap + qw) / 2
    rule_x = left + lw + gap
    return (
        _draw(logo, left + lw / 2, CY, lw, lh)
        + el("rect", x=rule_x, y=CY - lh / 2, width=rule, height=lh, rx=2, fill=INK)
        + _draw(qualifier, rule_x + rule + gap + qw / 2, CY, qw, qh)
    )


# --- Topic motifs ----------------------------------------------------------------
# Each motif is one gesture from the product, drawn with a few bold shapes and
# no labels. One shape per motif is cyan.


def _bar(x: float, y: float, w: float, fill: str, h: float = 36) -> str:
    """A rounded bar, vertically centred on y."""
    return el("rect", x=x, y=y - h / 2, width=w, height=h, rx=10, fill=fill)


def _line(x1: float, y1: float, x2: float, y2: float, color: str = GUIDE, width=8) -> str:
    return el(
        "line", x1=x1, y1=y1, x2=x2, y2=y2, stroke=color, stroke_width=width, stroke_linecap="round"
    )


def _trace() -> str:
    """Span waterfall: four spans on one timeline, one selected."""
    x0, span = 260, 680
    spans = [(0.0, 1.0, INK), (0.06, 0.46, SECONDARY), (0.5, 0.94, FOCAL), (0.56, 0.78, SECONDARY)]
    top = CY - 1.5 * 76
    return "".join(
        _bar(x0 + span * a, top + i * 76, span * (b - a), fill)
        for i, (a, b, fill) in enumerate(spans)
    )


def _eval() -> str:
    """Score ring: a passing score with a check."""
    r = 128
    circ = 2 * math.pi * r
    ring = {"cx": CX, "cy": CY, "r": r, "fill": "none", "stroke_width": 36}
    check = f"M{CX - 44} {CY + 2} l30 30 l58 -62"
    return (
        el("circle", **ring, stroke=GUIDE)
        + el(
            "circle",
            **ring,
            stroke=FOCAL,
            stroke_linecap="round",
            stroke_dasharray=f"{circ * 0.78:.1f} {circ:.1f}",
            transform=f"rotate(-90 {CX} {CY})",
        )
        + el(
            "path",
            d=check,
            fill="none",
            stroke=INK,
            stroke_width=18,
            stroke_linecap="round",
            stroke_linejoin="round",
        )
    )


def _prompt() -> str:
    """Prompt template: three lines of text, one holding a variable."""
    x0 = 320
    return (
        _bar(x0, CY - 80, 560, SECONDARY)
        + _bar(x0, CY, 150, SECONDARY)
        + _bar(x0 + 170, CY, 220, FOCAL)
        + _bar(x0 + 410, CY, 150, SECONDARY)
        + _bar(x0, CY + 80, 380, SECONDARY)
    )


def _dataset() -> str:
    """Table: a header row over three example rows, ruled into columns."""
    x0, y0, tw, row = 270, CY - 160, 660, 80
    cols = [x0, x0 + 200, x0 + 440, x0 + tw]
    th = row * 4
    out = [
        el("rect", x=x0, y=y0, width=tw, height=row, rx=16, fill=RAISED),
        el("rect", x=x0, y=y0 + row / 2, width=tw, height=row / 2, fill=RAISED),
    ]
    out += [_line(x0, y0 + r * row, x0 + tw, y0 + r * row, width=4) for r in (1, 2, 3)]
    out += [_line(x, y0, x, y0 + th, width=4) for x in cols[1:-1]]
    widths = [(110, 150, 120), (90, 170, 80), (120, 130, 100), (70, 160, 110)]
    for r, row_widths in enumerate(widths):
        y = y0 + row * r + row / 2
        for c, w in enumerate(row_widths):
            fill = INK if r == 0 else (FOCAL if (r, c) == (2, 0) else SECONDARY)
            out.append(_bar(cols[c] + 32, y, w, fill, h=24))
    out.append(
        el(
            "rect",
            x=x0,
            y=y0,
            width=tw,
            height=th,
            rx=16,
            fill="none",
            stroke=GUIDE,
            stroke_width=6,
        )
    )
    return "".join(out)


def _experiment() -> str:
    """Comparison: baseline and candidate runs, the best candidate highlighted."""
    base = CY + 150
    pairs = [(0.45, 0.62), (0.52, 0.86), (0.4, 0.58)]
    out = []
    for i, (a, b) in enumerate(pairs):
        x = 372 + i * 168
        out.append(_column(x, base, a * 330, SECONDARY))
        out.append(_column(x + 84, base, b * 330, FOCAL if i == 1 else INK))
    return "".join(out)


def _column(x: float, base: float, h: float, fill: str) -> str:
    return el("rect", x=x, y=base - h, width=72, height=h, rx=10, fill=fill)


def _agent() -> str:
    """Agent trajectory: the agent calls a tool, hands off to a subagent that
    calls its own tool, and returns the answer."""
    y = CY

    def step(x: float, r: float, fill: str) -> str:
        return el("circle", cx=x, cy=y, r=r, fill=fill)

    def tool(x: float, s: float) -> str:
        return el(
            "rect",
            x=x - s / 2,
            y=y - s / 2,
            width=s,
            height=s,
            rx=12,
            fill=GROUND,
            stroke=SECONDARY,
            stroke_width=10,
        )

    # Agent, tool, subagent and answer, evenly spaced and centred as a group.
    r, s, box_w, box_h, gap = 44, 76, 300, 190, 64
    start = CX - (2 * r + s + box_w + 2 * r + 3 * gap) / 2 + r
    first_tool = start + r + gap + s / 2
    box_x = first_tool + s / 2 + gap
    answer = box_x + box_w + gap + r
    inner_step, inner_tool = box_x + 82, box_x + box_w - 82
    return (
        _line(start, y, box_x, y)
        + _line(box_x + box_w, y, answer, y)
        + _line(inner_step, y, inner_tool, y)
        + el(
            "rect",
            x=box_x,
            y=y - box_h / 2,
            width=box_w,
            height=box_h,
            rx=28,
            fill="none",
            stroke=GUIDE,
            stroke_width=6,
        )
        + step(start, r, INK)
        + tool(first_tool, s)
        + step(inner_step, 30, INK)
        + tool(inner_tool, 56)
        + step(answer, r, FOCAL)
    )


def _retrieval() -> str:
    """Retrieval: a search over three ranked results, the top one highlighted."""
    lens = el("circle", cx=340, cy=CY - 20, r=58, fill="none", stroke=INK, stroke_width=16)
    handle = _line(382, CY + 22, 426, CY + 66, INK, 18)
    results = "".join(
        _bar(500, CY - 80 + i * 80, w, FOCAL if i == 0 else SECONDARY)
        for i, w in enumerate((420, 320, 220))
    )
    return lens + handle + results


MOTIFS = {
    "trace": _trace,
    "eval": _eval,
    "dataset": _dataset,
    "prompt": _prompt,
    "experiment": _experiment,
    "agent": _agent,
    "retrieval": _retrieval,
}
