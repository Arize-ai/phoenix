"""Page banner template for Phoenix docs.

Pure functions, like card_design: a banner spec, its wrapped title and its
marks in, an SVG document out. Banners reuse the cards' palette, marks and
drawings, so cards never depend on this module and a banner change never
re-renders a card. references/card-design.md describes both.
"""

from __future__ import annotations

import math
from html import escape

from card_design import (
    CX,
    CY,
    FOCAL,
    GROUND,
    GUIDE,
    INK,
    MOTIFS,
    SECONDARY,
    Mark,
    _bar,
    _draw,
    _fit,
    _recolor,
    el,
)

# --- Page banners ----------------------------------------------------------------
# A banner opens a docs page at 3:1 and says one thing: the page title, set
# large and heavy. It sits on a 12-column grid: 96px outer margins, 24px
# gutters, 90px columns. The title takes columns 1-6; art takes columns 8-12;
# column 7 stays empty as breathing room between them.

BW, BH = 1536, 512
MARGIN_X, MARGIN_Y, GUTTER, COLUMN = 96, 88, 24, 90
TITLE_FONT, TITLE_WEIGHT = "Geist-Bold.ttf", 700
TITLE_SIZE, TITLE_LEADING, TITLE_TRACKING = 104, 1.0, -0.035
CAP_HEIGHT = 0.71  # Geist's cap height, in ems


def columns(first: int, last: int) -> tuple[float, float]:
    """Left edge and width of grid columns first..last (1-based, inclusive)."""
    x = MARGIN_X + (first - 1) * (COLUMN + GUTTER)
    return x, (last - first + 1) * COLUMN + (last - first) * GUTTER


TITLE_COLUMNS = columns(1, 6)
ART_COLUMNS = columns(8, 12)


def compose_banner(banner: dict, title: list[str], marks: dict[str, Mark]) -> str:
    """Return the SVG document for one page banner; title is already wrapped into lines."""
    if banner.get("motif"):
        art = _banner_motif(banner["motif"])
    elif banner.get("marks"):
        art = _banner_marks([marks[m] for m in banner["marks"]])
    elif banner.get("logo"):
        art = _banner_logo(marks[banner["logo"]])
    else:
        raise ValueError(f"{banner['id']}: a banner needs a motif, a logo or marks")
    return el(
        "svg",
        el("defs", _recolor("ink", INK)),
        el("rect", width=BW, height=BH, fill=GROUND),
        _banner_title(title),
        art,
        xmlns="http://www.w3.org/2000/svg",
        width=BW,
        height=BH,
        viewBox=f"0 0 {BW} {BH}",
    )


def _banner_title(lines: list[str]) -> str:
    """The title, its cap height centred vertically on the canvas."""
    x, _ = TITLE_COLUMNS
    step = TITLE_SIZE * TITLE_LEADING
    block = TITLE_SIZE * CAP_HEIGHT + step * (len(lines) - 1)
    baseline = (BH - block) / 2 + TITLE_SIZE * CAP_HEIGHT
    return "".join(
        el(
            "text",
            escape(line),
            x=x,
            y=f"{baseline + i * step:.1f}",
            fill=INK,
            font_family="Geist",
            font_weight=TITLE_WEIGHT,
            font_size=TITLE_SIZE,
            letter_spacing=f"{TITLE_SIZE * TITLE_TRACKING:.2f}",
        )
        for i, line in enumerate(lines)
    )


def _art_box() -> tuple[float, float, float, float]:
    x, w = ART_COLUMNS
    return x, MARGIN_Y, w, BH - 2 * MARGIN_Y


def _banner_motif(motif: str) -> str:
    """A topic drawing, scaled from its card footprint into the art columns."""
    x, y, w, h = _art_box()
    foot_w, foot_h = 780, 420  # the drawings' footprint on the card canvas
    scale = min(w / foot_w, h / foot_h)
    dx, dy = x + w / 2 - CX * scale, y + h / 2 - CY * scale
    return el(
        "g", BANNER_MOTIFS[motif](), transform=f"translate({dx:.2f} {dy:.2f}) scale({scale:.4f})"
    )


def _banner_logo(mark: Mark) -> str:
    x, y, w, h = _art_box()
    mw, mh = _fit(mark, w * 0.62, h * 0.72, w * h * 0.16)
    return _draw(mark, x + w / 2, y + h / 2, mw, mh)


def _banner_marks(marks: list[Mark]) -> str:
    """Supported brands in equal cells, sized by visual weight: one row of up to four,
    or two rows for five or six."""
    x, y, w, h = _art_box()
    cols = len(marks) if len(marks) <= 4 else math.ceil(len(marks) / 2)
    rows = math.ceil(len(marks) / cols)
    cw, ch = w / cols, h / rows
    side = min(cw * 0.6, ch * 0.5)
    out = []
    for i, mark in enumerate(marks):
        row, col = divmod(i, cols)
        mw, mh = _fit(mark, side, side, side * side * 0.55)
        out.append(_draw(mark, x + cw * (col + 0.5), y + ch * (row + 0.5), mw, mh))
    return "".join(out)


# --- Banner-only drawings ----------------------------------------------------------
# Drawn in card coordinates with the cards' shape vocabulary, so one can move to
# card_design.MOTIFS when a card needs it. Moving it re-fingerprints every card.


def _switch(x: float, y: float, on: bool) -> str:
    """A setting: a track with its knob, cyan and to the right when on."""
    w, h, r = 120, 60, 18
    track = {"x": x, "y": y - h / 2, "width": w, "height": h, "rx": h / 2}
    if on:
        return el("rect", **track, fill=FOCAL) + el("circle", cx=x + w - h / 2, cy=y, r=r, fill=INK)
    return el("rect", **track, fill="none", stroke=GUIDE, stroke_width=6) + el(
        "circle", cx=x + h / 2, cy=y, r=r, fill=SECONDARY
    )


def _settings() -> str:
    """Settings: three labelled switches, one turned on."""
    x0, x1, step = 340, 740, 100
    rows = [(-step, 240, False), (0, 180, True), (step, 210, False)]
    return "".join(_bar(x0, CY + dy, w, SECONDARY) + _switch(x1, CY + dy, on) for dy, w, on in rows)


BANNER_MOTIFS = {**MOTIFS, "settings": _settings}
