"""Source-specific dataset illustrations, using the shared card palette and canvas.

Keep these task drawings separate so adding one does not change existing card
fingerprints. The CLI includes this module only for the motifs defined here.
"""

from __future__ import annotations

import card_design as design


def _csv() -> str:
    """A folded document containing delimited rows and columns."""
    el = design.el
    return (
        el(
            "path",
            d="M390 104H690L810 224V544H390Z M690 104V224H810",
            fill="none",
            stroke=design.INK,
            stroke_width=10,
            stroke_linejoin="round",
        )
        + el(
            "path",
            d="M442 270H758V480H442Z M442 340H758 M442 410H758 "
            "M547 270V480 M653 270V480",
            fill="none",
            stroke=design.GUIDE,
            stroke_width=6,
        )
        + el("rect", x=463, y=296, width=62, height=18, rx=7, fill=design.SECONDARY)
        + el("rect", x=569, y=366, width=62, height=18, rx=7, fill=design.FOCAL)
        + el("rect", x=675, y=436, width=62, height=18, rx=7, fill=design.SECONDARY)
    )


def _jsonl() -> str:
    """Braces surround separate record lines, with one record selected."""
    el = design.el
    brace = (
        "M445 144H417Q377 144 377 184V274Q377 324 329 324"
        "Q377 324 377 374V464Q377 504 417 504H445"
    )
    return (
        el("path", d=brace, fill="none", stroke=design.INK, stroke_width=12)
        + el(
            "path",
            d=brace,
            transform="translate(1200 0) scale(-1 1)",
            fill="none",
            stroke=design.INK,
            stroke_width=12,
        )
        + el("rect", x=478, y=211, width=244, height=34, rx=12, fill=design.SECONDARY)
        + el("rect", x=478, y=307, width=190, height=34, rx=12, fill=design.FOCAL)
        + el("rect", x=478, y=403, width=244, height=34, rx=12, fill=design.SECONDARY)
    )


def _synthetic() -> str:
    """Generated examples: a sparkle produces three new record lines."""
    el = design.el
    return (
        el(
            "path",
            d="M400 220L428 296L504 324L428 352L400 428L372 352L296 324L372 296Z",
            fill=design.FOCAL,
        )
        + el(
            "path",
            d="M548 324H618 M590 296L618 324L590 352",
            fill="none",
            stroke=design.INK,
            stroke_width=10,
            stroke_linecap="round",
            stroke_linejoin="round",
        )
        + el("rect", x=680, y=211, width=220, height=34, rx=12, fill=design.SECONDARY)
        + el("rect", x=680, y=307, width=180, height=34, rx=12, fill=design.INK)
        + el("rect", x=680, y=403, width=220, height=34, rx=12, fill=design.SECONDARY)
    )


MOTIFS = {
    "dataset-csv": _csv,
    "dataset-jsonl": _jsonl,
    "dataset-synthetic": _synthetic,
}


def compose(card: dict) -> str:
    """Render one dataset-source drawing on the shared card canvas."""
    return design.el(
        "svg",
        design.el("rect", width=design.W, height=design.H, fill=design.GROUND),
        MOTIFS[card["motif"]](),
        xmlns="http://www.w3.org/2000/svg",
        width=design.W,
        height=design.H,
        viewBox=f"0 0 {design.W} {design.H}",
    )
