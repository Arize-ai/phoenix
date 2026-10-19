"""Server-side provenance for the ``annotator_kind`` annotation field.

``annotator_kind`` values ``LLM`` and ``CODE`` are claims about *how* an
annotation was produced: they assert that the annotation is the output of a
Phoenix evaluator (an LLM judge or a code evaluator) executed by the server
itself. Exactly one writer derives those values server-side: the in-process
experiment runner (``src/phoenix/server/daemons/experiment_runner.py``),
which persists through direct database inserts and never through the HTTP
API.

Historically every external surface (REST and GraphQL) accepted
``annotator_kind`` as a client-supplied literal and persisted it as-is. The
kind was therefore a forgery primitive: any credential that can ingest
(including the system API key handed to the monitored application for trace
logging) could write ``annotator_kind=LLM`` records indistinguishable from
the server's own judge output, and annotation summaries aggregated the two
together. Authentication decides *who* can write; it cannot decide *what a
writer may claim about who judged*.

The fix: external clients can no longer persist LLM/CODE kinds. Every
external write path re-stamps them to ``EXTERNAL`` before persistence, so
``annotator_kind=LLM`` (and ``CODE``) rows are exactly the rows the server's
own evaluators produced, while client-supplied evaluations remain visible
under their own provenance. ``HUMAN`` is passed through unchanged: it is an
honest claim about a person that the server cannot derive either way.
"""

from __future__ import annotations

EXTERNAL_ANNOTATOR_KIND = "EXTERNAL"

# Kinds whose meaning ("graded by a server-executed evaluator") only the
# server itself can establish. No external client may persist these.
SERVER_DERIVED_ANNOTATOR_KINDS = frozenset({"LLM", "CODE"})


def resolve_external_annotator_kind(annotator_kind: str) -> str:
    """Re-stamp a client-supplied annotator kind to its true provenance.

    Returns ``EXTERNAL`` for ``LLM`` and ``CODE``; any other value (``HUMAN``,
    ``EXTERNAL``) is returned unchanged. This function must be applied to
    every annotator kind that enters the database from an external (REST or
    GraphQL) write path. It must NOT be applied to kinds derived by the
    in-process experiment runner, which are the only legitimate source of
    LLM/CODE annotations.
    """
    if annotator_kind in SERVER_DERIVED_ANNOTATOR_KINDS:
        return EXTERNAL_ANNOTATOR_KIND
    return annotator_kind
