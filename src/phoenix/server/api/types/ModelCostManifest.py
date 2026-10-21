from datetime import datetime

import strawberry

from phoenix.server.cost_tracking.apply_manifest import ModelCostManifestVersion


@strawberry.type
class ModelCostManifest:
    generated_at: datetime = strawberry.field(
        description="When the manifest's built-in models and token prices were generated.",
    )


def to_gql_model_cost_manifest(marker: ModelCostManifestVersion) -> ModelCostManifest:
    return ModelCostManifest(generated_at=marker.generated_at)
