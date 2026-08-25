"""Replay recorded OpenInference traces into a Phoenix collector.

Scenarios contain a protobuf-JSON ``ExportTraceServiceRequest`` on each line of
``traces.jsonl`` plus descriptive metadata in ``manifest.json``. The replayer
splits batches into traces, interleaves recorded sessions without reordering
their turns, and assigns fresh trace, span, session, and timestamp values on
every pass. Token-bearing spans are redrawn from scenario-fitted lognormal
distributions; a seeded per-span contamination draw jointly inflates tokens and
latency and marks ground-truth anomalies. Recorded cost attributes are removed
because Phoenix derives cost from token counts and model pricing.

``OTLPHTTPExporter`` sends the rewritten protobuf request to the standard OTLP
HTTP ``/v1/traces`` route. Importing Phoenix does not import this package; the
``phoenix datagen`` command loads it only when invoked.
"""

from phoenix.datagen.composer import (
    ComposedSession,
    ComposedTrace,
    ComposerConfig,
    SessionComposer,
)
from phoenix.datagen.exporter import OTLPHTTPExporter
from phoenix.datagen.loader import Scenario, ScenarioError, load_scenario
from phoenix.datagen.replayer import Anomaly, EmittedTrace, Replayer
from phoenix.datagen.schema import (
    Archetype,
    Fragment,
    FragmentRecordV2,
    GenerationLane,
    LengthBand,
    ModelUsed,
    ModelUsedRecord,
    QualityTier,
    ScenarioManifestV2,
    SchemaValidationError,
    validate_fragment_v2,
    validate_manifest_v2,
)

__all__ = [
    "Anomaly",
    "Archetype",
    "ComposedSession",
    "ComposedTrace",
    "ComposerConfig",
    "EmittedTrace",
    "Fragment",
    "FragmentRecordV2",
    "GenerationLane",
    "LengthBand",
    "ModelUsed",
    "ModelUsedRecord",
    "OTLPHTTPExporter",
    "QualityTier",
    "Replayer",
    "Scenario",
    "ScenarioError",
    "ScenarioManifestV2",
    "SchemaValidationError",
    "SessionComposer",
    "load_scenario",
    "validate_fragment_v2",
    "validate_manifest_v2",
]
