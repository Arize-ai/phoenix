"""Deterministic application-state materialization for datagen matrix cells."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from hashlib import sha256
from math import isfinite
from typing import TYPE_CHECKING, Any, Mapping

if TYPE_CHECKING or __package__:
    from scripts.datagen.generation import MatrixCell
    from scripts.datagen.profile import (
        ApplicationProfileV1,
        CorpusEdit,
        SeedVariant,
        ToolPatchOperation,
        ToolResultOverlay,
    )
    from scripts.datagen.serialization import canonical_bytes, plain_json
else:
    from profile import (
        ApplicationProfileV1,
        CorpusEdit,
        SeedVariant,
        ToolPatchOperation,
        ToolResultOverlay,
    )

    from generation import MatrixCell
    from serialization import canonical_bytes, plain_json

_SELECTION_NAMESPACE = "phoenix-datagen-seed-mechanics-v1"


class SeedMechanicsError(ValueError):
    """Raised when an authored environment cannot be materialized safely."""


@dataclass(frozen=True)
class MaterializedSeedEnvironment:
    documents: Mapping[str, str]
    tool_fixture_data: Mapping[str, Any]
    tool_result_overlays: tuple[ToolResultOverlay, ...]
    simulator_traits: tuple[str, ...]
    route_context: str | None
    digest: str
    document_seed_ids: Mapping[str, tuple[str, ...]] = field(default_factory=dict)
    trait_seed_ids: tuple[str, ...] = ()

    def visible_dict(self) -> dict[str, Any]:
        return {
            "documents": dict(sorted(self.documents.items())),
            "tool_fixture_data": self.tool_fixture_data,
            "tool_result_overlays": [_overlay_dict(item) for item in self.tool_result_overlays],
            "simulator_traits": list(self.simulator_traits),
            "route_context": self.route_context,
        }


def materialize_seed_environment(
    profile: ApplicationProfileV1,
    cell: MatrixCell,
    documents: Mapping[str, str],
    fixture_data: Mapping[str, Any],
) -> MaterializedSeedEnvironment:
    """Materialize the application state selected by a matrix-v2 profile draw."""

    _validate_inputs(profile, cell, documents)
    materialized_documents = dict(documents)
    overlays: list[ToolResultOverlay] = []
    traits: list[str] = []
    document_seed_ids: dict[str, set[str]] = {}
    trait_seed_ids: set[str] = set()
    selected_routes: dict[str, str] = {}
    occupied_paths: list[tuple[str, Mapping[str, Any], str]] = []

    for seed in sorted(profile.adversarial_seeds, key=lambda item: item.seed_id):
        intensity = cell.profile.seed_intensities[seed.seed_id]
        strength = _strength_for_intensity(intensity)
        variants = seed.mechanics.variants_for(strength)
        variant = variants[_variant_index(cell.cell_id, seed.seed_id, intensity, len(variants))]
        selected_routes[seed.seed_id] = variant.route
        edited_documents = _apply_corpus_edits(materialized_documents, variant)
        for document_id in edited_documents:
            document_seed_ids.setdefault(document_id, set()).add(seed.seed_id)
        _append_tool_overlays(overlays, occupied_paths, variant, seed_id=seed.seed_id)
        traits.extend(variant.simulator_traits)
        if variant.simulator_traits:
            trait_seed_ids.add(seed.seed_id)

    route_context = (
        selected_routes[cell.profile.targeted_seed_id]
        if cell.profile.target_mode == "targeted" and cell.profile.targeted_seed_id is not None
        else None
    )
    visible = {
        "documents": dict(sorted(materialized_documents.items())),
        "tool_fixture_data": fixture_data,
        "tool_result_overlays": [_overlay_dict(item) for item in overlays],
        "simulator_traits": traits,
        "route_context": route_context,
    }
    try:
        visible_bytes = canonical_bytes(plain_json(visible))
        fixture_bytes = canonical_bytes(plain_json(fixture_data))
    except (TypeError, ValueError) as error:
        raise SeedMechanicsError(
            f"materialized application state must be JSON-compatible: {error}"
        ) from error
    return MaterializedSeedEnvironment(
        documents=dict(sorted(materialized_documents.items())),
        tool_fixture_data=json.loads(fixture_bytes),
        tool_result_overlays=tuple(overlays),
        simulator_traits=tuple(traits),
        route_context=route_context,
        digest=sha256(visible_bytes).hexdigest(),
        document_seed_ids={
            document_id: tuple(sorted(seed_ids))
            for document_id, seed_ids in sorted(document_seed_ids.items())
        },
        trait_seed_ids=tuple(sorted(trait_seed_ids)),
    )


def _validate_inputs(
    profile: ApplicationProfileV1,
    cell: MatrixCell,
    documents: Mapping[str, str],
) -> None:
    draw = cell.profile
    if (draw.profile_id, draw.domain, draw.archetype) != (
        profile.profile_id,
        profile.domain,
        profile.archetype,
    ):
        raise SeedMechanicsError("matrix cell profile identity does not match the selected profile")
    expected_seed_ids = {seed.seed_id for seed in profile.adversarial_seeds}
    actual_seed_ids = set(draw.seed_intensities)
    if actual_seed_ids != expected_seed_ids:
        raise SeedMechanicsError(
            "seed intensities must contain exactly the selected profile's seed IDs"
        )
    for seed_id, intensity in draw.seed_intensities.items():
        if (
            type(intensity) not in (int, float)
            or not isfinite(float(intensity))
            or not 0 <= intensity <= 1
        ):
            raise SeedMechanicsError(f"seed intensity for {seed_id!r} must be between 0 and 1")
    if draw.target_mode == "ambient" and draw.targeted_seed_id is not None:
        raise SeedMechanicsError("ambient cells may not name a targeted seed")
    if draw.target_mode == "targeted" and draw.targeted_seed_id not in expected_seed_ids:
        raise SeedMechanicsError("targeted cells must name a seed from the selected profile")
    expected_documents = {document.document_id for document in profile.corpus_documents}
    if set(documents) != expected_documents:
        raise SeedMechanicsError(
            "documents must contain exactly the selected profile's corpus document IDs"
        )
    if any(not isinstance(content, str) for content in documents.values()):
        raise SeedMechanicsError("document content must be text")


def _strength_for_intensity(intensity: float) -> str:
    if intensity < 0.2:
        return "subtle"
    if intensity < 0.5:
        return "moderate"
    return "strong"


def _variant_index(cell_id: str, seed_id: str, intensity: float, variant_count: int) -> int:
    identity = "\0".join((_SELECTION_NAMESPACE, cell_id, seed_id, float(intensity).hex())).encode()
    return int.from_bytes(sha256(identity).digest(), "big") % variant_count


def _apply_corpus_edits(documents: dict[str, str], variant: SeedVariant) -> tuple[str, ...]:
    edited = []
    for edit in variant.corpus_edits:
        content = documents[edit.document_id]
        if edit.operation == "replace_once":
            _replace_once(documents, edit, content)
        else:
            if edit.text is None:
                raise SeedMechanicsError("append corpus edits require text")
            documents[edit.document_id] = content + edit.text
        edited.append(edit.document_id)
    return tuple(edited)


def _replace_once(documents: dict[str, str], edit: CorpusEdit, content: str) -> None:
    if edit.source is None or edit.replacement is None:
        raise SeedMechanicsError("replace_once corpus edits require source and replacement text")
    matches = content.count(edit.source)
    if matches != 1:
        raise SeedMechanicsError(
            f"replace_once source for document {edit.document_id!r} matched {matches} times"
        )
    documents[edit.document_id] = content.replace(edit.source, edit.replacement, 1)


def _append_tool_overlays(
    overlays: list[ToolResultOverlay],
    occupied_paths: list[tuple[str, Mapping[str, Any], str]],
    variant: SeedVariant,
    *,
    seed_id: str,
) -> None:
    for overlay in variant.tool_overlays:
        for operation in overlay.operations:
            for tool_name, arguments, path in occupied_paths:
                if (
                    tool_name == overlay.tool_name
                    and path == operation.path
                    and _argument_matches_overlap(arguments, overlay.match_arguments)
                ):
                    raise SeedMechanicsError(
                        f"tool overlays collide at {overlay.tool_name!r} {operation.path!r}"
                    )
            occupied_paths.append((overlay.tool_name, overlay.match_arguments, operation.path))
        overlays.append(
            ToolResultOverlay(
                overlay.tool_name,
                overlay.match_arguments,
                overlay.operations,
                source_seed_id=seed_id,
            )
        )


def _argument_matches_overlap(left: Mapping[str, Any], right: Mapping[str, Any]) -> bool:
    return all(left[key] == right[key] for key in left.keys() & right.keys())


def _overlay_dict(overlay: ToolResultOverlay) -> dict[str, Any]:
    return {
        "tool_name": overlay.tool_name,
        "match_arguments": dict(sorted(overlay.match_arguments.items())),
        "operations": [_operation_dict(operation) for operation in overlay.operations],
    }


def _operation_dict(operation: ToolPatchOperation) -> dict[str, Any]:
    result = {"operation": operation.operation, "path": operation.path}
    if operation.operation != "remove":
        result["value"] = operation.value
    return result
