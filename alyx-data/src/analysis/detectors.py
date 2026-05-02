"""Stage 2 detectors for failure shapes and multi-turn arcs.

These are the analyses called out in `stages/2-general-analysis/plan.md`
section 2.3 ("trajectory-level analyses, NEW") that don't reduce to a
one-line groupby. Keeping them in a module (instead of inline in the
notebook) lets the report cite them by symbol and lets Stage 3 reuse the
same heuristics for use-case grouping.

Three detectors:

- :func:`is_retry_phrase` / :func:`session_retry_followups` — short
  retry-shaped utterances. The predecessor flagged "try again", "fix my
  query", "yes please" as the most-repeated user queries (per
  `findings-2026-04-22.md`); we generalize to a phrase list and detect
  retries that *follow an agent turn*, which is what we'd actually score
  in an implicit-feedback evaluator.

- :func:`classify_followup_turn` — given a session's ordered
  ``query_sequence``, label each turn-after-the-first as one of
  ``retry`` / ``confirmation`` / ``refinement`` / ``new`` /
  ``continuation``. Ports the eyeballed taxonomy I want to surface in
  the report's "multi-turn shape" section.

- :func:`is_truncated_trajectory` — heuristic for "the session looks
  like it ended mid-flight". Defined in terms of error spans + status
  codes on the last spans of a session.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from typing import Any, Literal

import pandas as pd

# -- Phrase lists --------------------------------------------------------------

# Retry-shaped utterances. Short and recurring. Treat as implicit-negative
# feedback when they follow an agent turn within a session.
RETRY_PHRASES: tuple[str, ...] = (
    "try again",
    "try that again",
    "do it again",
    "fix my query",
    "fix the query",
    "fix it",
    "fix this",
    "no fix",
    "still wrong",
    "still broken",
    "nope",
    "wrong",
    "incorrect",
    "that's wrong",
    "thats wrong",
    "not right",
    "not what i asked",
    "redo",
    "retry",
)

# Affirmative confirmations (often follow a clarifying agent turn).
CONFIRMATION_PHRASES: tuple[str, ...] = (
    "yes",
    "yes please",
    "yes, please",
    "ok",
    "okay",
    "sure",
    "do it",
    "go ahead",
    "proceed",
    "thanks",
    "thank you",
    "ty",
    "perfect",
    "great",
)

# Single-word continuations / "next step" prompts that don't obviously
# refine or restart the previous question.
CONTINUATION_PHRASES: tuple[str, ...] = (
    "more",
    "continue",
    "next",
    "and",
    "also",
    "what else",
    "go on",
)

# Combined set used by :func:`classify_followup_turn` — pre-lowered for cheap
# membership checks.
_RETRY_SET = frozenset(p.lower() for p in RETRY_PHRASES)
_CONFIRM_SET = frozenset(p.lower() for p in CONFIRMATION_PHRASES)
_CONTINUE_SET = frozenset(p.lower() for p in CONTINUATION_PHRASES)

# Tokenization for refinement detection — strip punctuation, split on whitespace.
_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


# -- Single-utterance detectors ------------------------------------------------


def _normalize(text: str | None) -> str:
    """Lowercase + collapse whitespace + strip trailing punctuation."""
    if text is None:
        return ""
    s = re.sub(r"\s+", " ", str(text).strip().lower())
    return s.rstrip("?.!,;:")


def is_retry_phrase(text: str | None) -> bool:
    """True if a normalized utterance is itself a retry-shaped phrase."""
    if text is None:
        return False
    norm = _normalize(text)
    if not norm:
        return False
    if norm in _RETRY_SET:
        return True
    # Allow short phrases that contain a retry phrase as a substring,
    # e.g. "fix my query please". Cap the length so we don't catch
    # full-sentence questions that mention the word "wrong" in passing.
    if len(norm) <= 40:
        for p in _RETRY_SET:
            if p in norm:
                return True
    return False


def is_confirmation_phrase(text: str | None) -> bool:
    """True if a normalized utterance is an affirmative confirmation."""
    norm = _normalize(text)
    return bool(norm) and norm in _CONFIRM_SET


def is_continuation_phrase(text: str | None) -> bool:
    """True if a normalized utterance is a generic "continue" prompt."""
    norm = _normalize(text)
    return bool(norm) and norm in _CONTINUE_SET


# -- Per-session helpers -------------------------------------------------------


def _coerce_sequence(seq: Any) -> list[Any]:
    """Coerce a per-session sequence column to a Python list.

    ``sessions.parquet`` stores ``query_sequence`` / ``router_type_sequence``
    as numpy arrays after a `read_parquet`. Callers want list semantics
    (slicing, iteration with ``zip``, etc).
    """
    if seq is None:
        return []
    if isinstance(seq, list):
        return seq
    # numpy array / pandas array — both expose ``.tolist()``.
    if hasattr(seq, "tolist"):
        return list(seq.tolist())
    return list(seq)


_TurnLabel = Literal["retry", "confirmation", "continuation", "refinement", "new", "empty"]


def classify_followup_turn(
    prev_text: str | None,
    current_text: str | None,
    refinement_jaccard: float = 0.25,
) -> _TurnLabel:
    """Label one follow-up turn relative to the immediately prior turn.

    Decision order — first match wins:

    - empty utterance → ``empty``
    - retry phrase → ``retry``
    - confirmation phrase → ``confirmation``
    - continuation phrase → ``continuation``
    - shares ≥ ``refinement_jaccard`` token-Jaccard with prior → ``refinement``
    - otherwise → ``new``
    """
    norm = _normalize(current_text)
    if not norm:
        return "empty"
    if is_retry_phrase(current_text):
        return "retry"
    if is_confirmation_phrase(current_text):
        return "confirmation"
    if is_continuation_phrase(current_text):
        return "continuation"

    cur_tokens = set(_TOKEN_RE.findall(norm))
    prev_tokens = set(_TOKEN_RE.findall(_normalize(prev_text)))
    if cur_tokens and prev_tokens:
        jacc = len(cur_tokens & prev_tokens) / len(cur_tokens | prev_tokens)
        if jacc >= refinement_jaccard:
            return "refinement"
    return "new"


def classify_session_arcs(
    query_sequence: Any,
    refinement_jaccard: float = 0.25,
) -> list[_TurnLabel]:
    """Label every follow-up turn in a session.

    Returns one label per turn *after* the first — i.e. ``len(seq) - 1``
    labels. The first turn is unlabeled because the classifier is
    relative to the prior turn.
    """
    seq = _coerce_sequence(query_sequence)
    if len(seq) < 2:
        return []
    labels: list[_TurnLabel] = []
    for prev, curr in zip(seq[:-1], seq[1:]):
        labels.append(classify_followup_turn(prev, curr, refinement_jaccard=refinement_jaccard))
    return labels


def session_retry_followups(query_sequence: Any) -> int:
    """Count retry-shaped follow-up turns in one session."""
    return sum(1 for lab in classify_session_arcs(query_sequence) if lab == "retry")


# -- Truncated trajectories ----------------------------------------------------


def is_truncated_trajectory(
    spans_for_session: pd.DataFrame,
    *,
    error_spans_required: int = 1,
) -> bool:
    """Heuristic: did this session end while something was still going wrong?

    True when the *last* (by start_time) Alyx span has
    ``has_error == True`` OR ``status_code == "ERROR"``, AND the session
    has at least ``error_spans_required`` errored spans overall.

    The "last span errored" cut intentionally fires on sessions where the
    user got an error and gave up — the most diagnostic shape for Pixie
    eval coverage. The threshold guards against single-span flukes.
    """
    if spans_for_session.empty:
        return False
    df = spans_for_session.sort_values("start_time")
    last = df.iloc[-1]
    last_errored = bool(last.get("has_error")) or last.get("status_code") == "ERROR"
    err_total = int(df["has_error"].fillna(False).sum())
    return last_errored and err_total >= error_spans_required


# -- Aggregators (operate on full DataFrames) ----------------------------------


def session_arc_summary(sessions: pd.DataFrame) -> pd.DataFrame:
    """One row per session with a tally of arc labels.

    Output columns: ``session_id``, ``followup_count``, ``n_retry``,
    ``n_confirmation``, ``n_continuation``, ``n_refinement``, ``n_new``,
    ``n_empty``. Convenient for cross-tabbing arc shapes against router /
    org / internal flags.
    """
    rows: list[dict[str, Any]] = []
    for _, sess in sessions.iterrows():
        labels = classify_session_arcs(sess.get("query_sequence"))
        tally = {
            "session_id": sess["session_id"],
            "followup_count": len(labels),
            "n_retry": labels.count("retry"),
            "n_confirmation": labels.count("confirmation"),
            "n_continuation": labels.count("continuation"),
            "n_refinement": labels.count("refinement"),
            "n_new": labels.count("new"),
            "n_empty": labels.count("empty"),
        }
        rows.append(tally)
    return pd.DataFrame(rows)


def query_phrase_matches(
    queries: pd.DataFrame,
    phrases: Iterable[str] = RETRY_PHRASES,
) -> pd.DataFrame:
    """Per-phrase match counts (and distinct-user counts) on Layer 1 queries.

    Useful for the report's "friction signals" section. Looks at
    ``query_norm`` so the phrases match against the same normalization
    Layer 1 already applied.
    """
    norm = queries["query_norm"].fillna("")
    rows: list[dict[str, Any]] = []
    for p in phrases:
        mask = norm == p.lower()
        # Allow short utterances that contain the phrase too, mirroring
        # is_retry_phrase. Bound on length to avoid sentence-mention noise.
        contains = norm.str.len().le(40) & norm.str.contains(re.escape(p), regex=True)
        full_mask = mask | contains
        match_rows = queries.loc[full_mask]
        rows.append(
            {
                "phrase": p,
                "matches": int(full_mask.sum()),
                "distinct_users": int(match_rows["user_id"].nunique()),
                "distinct_sessions": int(match_rows["session_id"].nunique()),
            }
        )
    return pd.DataFrame(rows).sort_values("matches", ascending=False).reset_index(drop=True)


def render_session_markdown(
    session_id: str,
    sessions: pd.DataFrame,
    spans: pd.DataFrame,
    *,
    max_spans: int = 80,
) -> str:
    """Render one session's trajectory as a markdown snippet for the report.

    Renders the session header (identity + counters), then the ordered
    span list with kind/name/duration and a short truncation of the
    input/output values. Use ``max_spans`` to keep long trajectories
    readable in the rendered markdown.
    """
    sess_rows = sessions.loc[sessions["session_id"] == session_id]
    if sess_rows.empty:
        return f"_No session with id={session_id}_"
    sess = sess_rows.iloc[0]
    sps = spans.loc[spans["session_id"] == session_id].sort_values("start_time")

    lines: list[str] = []
    lines.append(f"### Session `{session_id}`")
    lines.append("")
    lines.append(
        f"- user: `{sess.get('user_email')}` ({'internal' if sess.get('is_internal') else 'external'})"
    )
    lines.append(f"- org: `{sess.get('org_name')}`")
    lines.append(
        f"- turns: {sess.get('turn_count')}, spans: {sess.get('span_count')}, "
        f"errors: {sess.get('error_count')}"
    )
    routers = _coerce_sequence(sess.get("router_type_sequence"))
    queries_seq = _coerce_sequence(sess.get("query_sequence"))
    lines.append("- router sequence: " + " → ".join(str(r) for r in routers))
    lines.append("")
    lines.append("**Queries:**")
    for i, q in enumerate(queries_seq):
        snippet = (str(q) or "").replace("\n", " ")[:200]
        lines.append(f"  {i}. {snippet}")
    lines.append("")
    lines.append("**Spans (head):**")
    for _, sp in sps.head(max_spans).iterrows():
        kind = sp.get("kind") or ""
        name = sp.get("name") or ""
        dur = sp.get("duration_ms")
        err = " ⚠" if sp.get("has_error") else ""
        tool = f" tool={sp.get('tool_name')}" if sp.get("tool_name") else ""
        lines.append(f"- {kind:>10}  {name}{tool}  ({dur}ms){err}")
    if len(sps) > max_spans:
        lines.append(f"- … ({len(sps) - max_spans} more spans)")
    return "\n".join(lines)


# -- Token-overlap helpers exposed for the notebook ----------------------------


def jaccard_overlap(a: str, b: str) -> float:
    """Token-set Jaccard overlap between two utterances. Used for plotting."""
    ta = set(_TOKEN_RE.findall(_normalize(a)))
    tb = set(_TOKEN_RE.findall(_normalize(b)))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def first_router(sessions: pd.DataFrame) -> pd.Series[Any]:
    """Per-session first router type (with the ``ROUTER-`` prefix stripped)."""

    def _pick(seq: Any) -> str | None:
        items = _coerce_sequence(seq)
        if not items:
            return None
        first = str(items[0])
        return first.removeprefix("ROUTER-")

    return sessions["router_type_sequence"].map(_pick)


def all_routers(sessions: pd.DataFrame) -> Sequence[str]:
    """Flat list of every router type seen across all sessions."""
    out: list[str] = []
    for seq in sessions["router_type_sequence"]:
        for r in _coerce_sequence(seq):
            if r is None:
                continue
            out.append(str(r).removeprefix("ROUTER-"))
    return out
