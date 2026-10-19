from datetime import datetime
from enum import Enum

import strawberry
from typing_extensions import assert_never

from phoenix.server.cost_tracking.apply_manifest import ModelCostManifestVersion


@strawberry.enum
class ModelCostManifestSource(Enum):
    BUNDLED = "BUNDLED"
    REMOTE = "REMOTE"


@strawberry.type
class ModelCostManifest:
    generated_at: datetime = strawberry.field(
        description="When the manifest's built-in models and token prices were generated.",
    )
    source: ModelCostManifestSource = strawberry.field(
        description="Whether the manifest was bundled with Phoenix or fetched at runtime.",
    )
    applied_at: datetime = strawberry.field(
        description="When the manifest was applied to the database.",
    )


def to_gql_model_cost_manifest(marker: ModelCostManifestVersion) -> ModelCostManifest:
    if marker.source == "bundled":
        source = ModelCostManifestSource.BUNDLED
    elif marker.source == "remote":
        source = ModelCostManifestSource.REMOTE
    else:
        assert_never(marker.source)
    return ModelCostManifest(
        generated_at=marker.generated_at,
        source=source,
        applied_at=marker.applied_at,
    )
