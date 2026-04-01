#!/usr/bin/env python3
"""Scale SVG files deterministically by rewriting all path coordinates
and positional attributes to native values at the target size.

Usage:
    uvx --with svgpathtools python scale-svg.py <target_size> <input> <output>
    uvx --with svgpathtools python scale-svg.py --batch <target_size> <input_dir> <output_dir>

Produces output equivalent to resizing in Figma — coordinates are
rewritten mathematically, not wrapped in a transform group.
"""

import argparse
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from svgpathtools import (  # type: ignore[import-not-found]
    Arc,
    CubicBezier,
    Line,
    QuadraticBezier,
    parse_path,
)

# Attributes holding coordinate/length values that need scaling
SCALE_X = {"x", "x1", "x2", "cx", "width", "rx", "dx"}
SCALE_Y = {"y", "y1", "y2", "cy", "height", "ry", "dy"}
SCALE_UNIFORM = {"r", "stroke-width"}
SKIP_TAGS = {"style", "script"}


def _fmt(v: float) -> str:
    """Format a number: max 4 decimal places, strip trailing zeros."""
    return f"{v:.4f}".rstrip("0").rstrip(".")


def scale_path_d(d: str, sx: float, sy: float) -> str:
    """Parse an SVG path d-attribute and scale all coordinates.

    Handles multiple subpaths (disconnected M commands) by detecting
    when a segment's start doesn't match the previous segment's end.
    """
    path = parse_path(d)
    parts: list[str] = []

    if not path:
        return d

    prev_end = None
    for seg in path:
        # Emit a new M command when the subpath is discontinuous
        # (start of path, or a new moveto)
        if prev_end is None or abs(seg.start - prev_end) > 1e-6:
            parts.append(f"M{_fmt(seg.start.real * sx)},{_fmt(seg.start.imag * sy)}")

        if isinstance(seg, Line):
            parts.append(f"L{_fmt(seg.end.real * sx)},{_fmt(seg.end.imag * sy)}")
        elif isinstance(seg, CubicBezier):
            parts.append(
                f"C{_fmt(seg.control1.real * sx)},{_fmt(seg.control1.imag * sy)} "
                f"{_fmt(seg.control2.real * sx)},{_fmt(seg.control2.imag * sy)} "
                f"{_fmt(seg.end.real * sx)},{_fmt(seg.end.imag * sy)}"
            )
        elif isinstance(seg, QuadraticBezier):
            parts.append(
                f"Q{_fmt(seg.control.real * sx)},{_fmt(seg.control.imag * sy)} "
                f"{_fmt(seg.end.real * sx)},{_fmt(seg.end.imag * sy)}"
            )
        elif isinstance(seg, Arc):
            parts.append(
                f"A{_fmt(seg.radius.real * sx)},{_fmt(seg.radius.imag * sy)} "
                f"{seg.rotation} "
                f"{int(seg.large_arc)},{int(seg.sweep)} "
                f"{_fmt(seg.end.real * sx)},{_fmt(seg.end.imag * sy)}"
            )

        prev_end = seg.end

    return " ".join(parts)


def scale_element(el: ET.Element, sx: float, sy: float) -> None:
    """Recursively scale all coordinate attributes and path data."""
    tag = el.tag.split("}")[-1] if "}" in el.tag else el.tag

    if tag in SKIP_TAGS:
        return

    # Scale path d attribute
    if "d" in el.attrib:
        el.attrib["d"] = scale_path_d(el.attrib["d"], sx, sy)

    # Scale positional/size attributes
    for attr in list(el.attrib.keys()):
        plain = attr.split("}")[-1] if "}" in attr else attr
        val = el.attrib[attr]
        try:
            num = float(val)
        except ValueError:
            continue

        if plain in SCALE_X:
            el.attrib[attr] = _fmt(num * sx)
        elif plain in SCALE_Y:
            el.attrib[attr] = _fmt(num * sy)
        elif plain in SCALE_UNIFORM:
            el.attrib[attr] = _fmt(num * (sx + sy) / 2)

    # Scale points attribute (polyline, polygon)
    if "points" in el.attrib:
        pairs = el.attrib["points"].strip().split()
        scaled: list[str] = []
        for pair in pairs:
            coords = re.split(r"[,\s]+", pair)
            if len(coords) == 2:
                scaled.append(f"{_fmt(float(coords[0]) * sx)},{_fmt(float(coords[1]) * sy)}")
        el.attrib["points"] = " ".join(scaled)

    for child in el:
        scale_element(child, sx, sy)


def scale_svg(input_path: str, target_size: int, output_path: str) -> None:
    """Scale an SVG file to target_size x target_size."""
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

    tree = ET.parse(input_path)
    root = tree.getroot()

    vb = root.attrib.get("viewBox", "")
    parts = re.split(r"[\s,]+", vb)
    if len(parts) != 4:
        print(f"ERROR: unexpected viewBox '{vb}' in {input_path}", file=sys.stderr)
        sys.exit(1)

    src_w, src_h = float(parts[2]), float(parts[3])
    sx = target_size / src_w
    sy = target_size / src_h

    print(
        f"  {Path(input_path).name}: {src_w}x{src_h} -> "
        f"{target_size}x{target_size} (scale: {sx:.4f})"
    )

    root.attrib["width"] = str(target_size)
    root.attrib["height"] = str(target_size)
    root.attrib["viewBox"] = f"0 0 {target_size} {target_size}"

    for child in root:
        scale_element(child, sx, sy)

    tree.write(output_path, xml_declaration=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Scale SVG files deterministically")
    parser.add_argument("--batch", action="store_true", help="Process a directory of SVGs")
    parser.add_argument("target_size", type=int, help="Target square size (e.g. 24 or 32)")
    parser.add_argument("input", help="Input SVG file or directory (with --batch)")
    parser.add_argument("output", help="Output SVG file or directory (with --batch)")
    args = parser.parse_args()

    if args.batch:
        in_dir = Path(args.input)
        out_dir = Path(args.output)
        out_dir.mkdir(parents=True, exist_ok=True)
        svg_files = sorted(in_dir.glob("*.svg"))
        if not svg_files:
            print(f"No .svg files found in {in_dir}", file=sys.stderr)
            sys.exit(1)
        print(f"Scaling {len(svg_files)} SVGs to {args.target_size}x{args.target_size}:")
        for svg in svg_files:
            scale_svg(str(svg), args.target_size, str(out_dir / svg.name))
    else:
        scale_svg(args.input, args.target_size, args.output)

    print("Done.")


if __name__ == "__main__":
    main()
