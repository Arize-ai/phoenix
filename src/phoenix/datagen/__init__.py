"""Replay recorded OpenInference traces into a Phoenix collector.

Corpora contain a protobuf-JSON ``ExportTraceServiceRequest`` on each line of
``traces.jsonl`` plus descriptive metadata in ``manifest.json``. The replayer
splits batches into traces, interleaves recorded sessions without reordering
their turns, and assigns fresh trace, span, session, and timestamp values on
every pass. Token-bearing spans are redrawn from corpus-fitted lognormal
distributions; a seeded per-span contamination draw jointly inflates tokens and
latency and marks ground-truth anomalies. Recorded cost attributes are removed
because Phoenix derives cost from token counts and model pricing.

``OTLPHTTPExporter`` sends the rewritten protobuf request to the standard OTLP
HTTP ``/v1/traces`` route. Importing Phoenix does not import this package; the
``phoenix datagen`` command loads it only when invoked.
"""

from phoenix.datagen.exporter import OTLPHTTPExporter
from phoenix.datagen.loader import Corpus, CorpusError, load_corpus
from phoenix.datagen.replayer import Anomaly, AnomalyManifest, EmittedTrace, Replayer

__all__ = [
    "Anomaly",
    "AnomalyManifest",
    "Corpus",
    "CorpusError",
    "EmittedTrace",
    "OTLPHTTPExporter",
    "Replayer",
    "load_corpus",
]
