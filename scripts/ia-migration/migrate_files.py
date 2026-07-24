#!/usr/bin/env python3
"""Phoenix IA migration -- mechanical phase (files, links, redirects, path-remap).

Order (matches plan sequencing):
  0. Normalize relative links whose target moves (resolve against OLD location) -> absolute.
  1. git mv every file per move-map.json.
  2. Rewrite absolute /docs/phoenix/<old> links tree-wide -> <new> (longest-first,
     segment-boundary safe, preserves #fragments and trailing chars).
  3. In docs.json: remap every page-path string; regenerate redirects (chain-collapse
     the existing set against moves, then append one redirect per move, dedupe by source).

Does NOT restructure the nav tab/group tree -- that is nav_restructure.py (step 2).
Idempotency is not required: run once on a clean branch.
"""
import json
import pathlib
import re
import subprocess
import sys
from collections import OrderedDict

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "phoenix"
DOCSJSON = ROOT / "docs.json"
MAP = pathlib.Path(__file__).resolve().parent / "move-map.json"
PREFIX = "/docs/phoenix/"

moves = json.loads(MAP.read_text())
OLD2NEW = {m["old"]: m["new"] for m in moves}           # repo-rel, no prefix
ABS_OLD2NEW = {PREFIX + o: PREFIX + n for o, n in OLD2NEW.items()}
MOVED_OLD = set(OLD2NEW)


def sh(*args):
    subprocess.run(args, cwd=ROOT, check=True)


# ---- Phase 0: normalise relative links that target a moving file ----------
REL_LINK = re.compile(r'(?P<pre>\]\(|href=")(?P<path>\.{1,2}/[^)"#\s]*)(?P<frag>#[^)"\s]*)?(?P<post>\)|")')


def resolve_rel(file_rel_dir: str, rel: str) -> str | None:
    """file_rel_dir: dir of the containing file, relative to docs/phoenix (posix).
    Returns repo-rel target (no prefix, no .mdx) or None."""
    base = pathlib.PurePosixPath(file_rel_dir)
    target = (base / rel).as_posix()
    parts = []
    for seg in target.split("/"):
        if seg == "." or seg == "":
            continue
        if seg == "..":
            if parts:
                parts.pop()
            continue
        parts.append(seg)
    out = "/".join(parts)
    if out.endswith(".mdx"):
        out = out[:-4]
    return out


def normalize_relative():
    changed = 0
    for p in DOCS.rglob("*.mdx"):
        file_rel = p.relative_to(DOCS).with_suffix("").as_posix()
        file_dir = str(pathlib.PurePosixPath(file_rel).parent)
        text = p.read_text()

        def repl(mm):
            tgt = resolve_rel(file_dir, mm.group("path"))
            if tgt is None or tgt not in MOVED_OLD:
                return mm.group(0)  # leave untouched (target not moving)
            frag = mm.group("frag") or ""
            abs_old = PREFIX + tgt
            return f'{mm.group("pre")}{abs_old}{frag}{mm.group("post")}'

        new = REL_LINK.sub(repl, text)
        if new != text:
            p.write_text(new)
            changed += 1
    print(f"[phase0] normalised relative->absolute in {changed} file(s)")


# ---- Phase 1: git mv --------------------------------------------------------
def do_moves():
    for m in moves:
        src = DOCS / (m["old"] + ".mdx")
        dst = DOCS / (m["new"] + ".mdx")
        if not src.exists():
            sys.exit(f"[phase1] MISSING SOURCE: {src}")
        if dst.exists():
            sys.exit(f"[phase1] TARGET EXISTS: {dst}")
        dst.parent.mkdir(parents=True, exist_ok=True)
        sh("git", "mv", str(src.relative_to(ROOT)), str(dst.relative_to(ROOT)))
    print(f"[phase1] moved {len(moves)} files")


# ---- Phase 2: absolute link rewrite (tree-wide) -----------------------------
def build_abs_regex():
    # longest old-path first so /a/b/c matches before /a/b at the same position
    alts = sorted(OLD2NEW, key=len, reverse=True)
    pat = re.escape(PREFIX) + "(?:" + "|".join(re.escape(a) for a in alts) + r")(?![A-Za-z0-9_\-])"
    return re.compile(pat)


def rewrite_absolute():
    rx = build_abs_regex()

    def repl(mm):
        matched = mm.group(0)  # /docs/phoenix/<old>
        old = matched[len(PREFIX):]
        return PREFIX + OLD2NEW[old]

    changed = 0
    # whole docs/ tree: catches docs/phoenix.mdx landing + docs/snippets/*, not just docs/phoenix/**
    for p in (ROOT / "docs").rglob("*.mdx"):
        text = p.read_text()
        new = rx.sub(repl, text)
        if new != text:
            p.write_text(new)
            changed += 1
    print(f"[phase2] rewrote absolute links in {changed} file(s)")


# ---- Phase 3: docs.json path-remap + redirects ------------------------------
def remap_paths(obj):
    """Recursively rewrite any page-path string 'docs/phoenix/<old>' -> new."""
    if isinstance(obj, str):
        if obj.startswith("docs/phoenix/"):
            rel = obj[len("docs/phoenix/"):]
            if rel in OLD2NEW:
                return "docs/phoenix/" + OLD2NEW[rel]
        return obj
    if isinstance(obj, list):
        return [remap_paths(x) for x in obj]
    if isinstance(obj, dict):
        return {k: remap_paths(v) for k, v in obj.items()}
    return obj


def collapse(dest: str) -> str:
    """Follow the move-map transitively so a redirect never points at a moved src."""
    seen = set()
    while dest.startswith(PREFIX):
        rel = dest[len(PREFIX):].split("#", 1)[0]
        if rel in OLD2NEW and rel not in seen:
            seen.add(rel)
            frag = dest[len(PREFIX) + len(rel):]
            dest = PREFIX + OLD2NEW[rel] + frag
        else:
            break
    return dest


def rebuild_redirects(existing):
    out = OrderedDict()
    # existing redirects, with destinations chain-collapsed
    for r in existing:
        out[r["source"]] = collapse(r["destination"])
    # one redirect per move (move-derived wins on conflict)
    for o, n in OLD2NEW.items():
        out[PREFIX + o] = PREFIX + n
    # drop no-ops and any source that equals its destination
    return [{"source": s, "destination": d} for s, d in out.items() if s != d]


def do_docsjson():
    data = json.loads(DOCSJSON.read_text())
    existing = data.get("redirects", [])
    data = remap_paths(data)
    data["redirects"] = rebuild_redirects(existing)
    DOCSJSON.write_text(json.dumps(data, indent=2) + "\n")
    print(f"[phase3] docs.json paths remapped; redirects: "
          f"{len(existing)} -> {len(data['redirects'])}")


if __name__ == "__main__":
    normalize_relative()
    do_moves()
    rewrite_absolute()
    do_docsjson()
    print("mechanical migration complete.")
