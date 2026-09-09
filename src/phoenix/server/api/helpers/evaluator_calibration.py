"""Content provenance for human evaluator calibration labels."""

import hashlib
import json
from typing import Any

CALIBRATION_METADATA_KEY = "phoenix_evaluator_calibration"


def calibration_source_hash(
    input: dict[str, Any], output: dict[str, Any], metadata: dict[str, Any]
) -> str:
    """Fingerprint evaluator source data, excluding human calibration annotations."""
    source = {
        "input": input,
        "output": output,
        "metadata": {
            key: value for key, value in metadata.items() if key != CALIBRATION_METADATA_KEY
        },
    }
    return hashlib.sha256(json.dumps(source, sort_keys=True).encode()).hexdigest()


def valid_calibration_outputs(
    input: dict[str, Any], output: dict[str, Any], metadata: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    """Return expected annotations whose source still matches the example."""
    calibration = metadata.get(CALIBRATION_METADATA_KEY)
    if not isinstance(calibration, dict) or calibration.get("schemaVersion") != 1:
        return {}
    labels = calibration.get("labels")
    if not isinstance(labels, dict):
        return {}
    source_hash = calibration_source_hash(input, output, metadata)
    return {
        name: value
        for name, value in labels.items()
        if isinstance(value, dict)
        and value.get("sourceHash") == source_hash
        and value.get("annotatorKind") == "HUMAN"
        and (isinstance(value.get("label"), str) or isinstance(value.get("score"), (int, float)))
    }
