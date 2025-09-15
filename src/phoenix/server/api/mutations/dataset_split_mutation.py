from typing import Optional

import strawberry
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.queries import Query
from phoenix.server.api.types.DatasetSplit import DatasetSplit
from phoenix.server.api.types.Identifier import Identifier


@strawberry.input
class CreateDatasetSplitInput:
    name: Identifier
    description: Optional[str] = None


@strawberry.input
class PatchDatasetSplitInput:
    prompt_label_id: GlobalID
    name: Optional[Identifier] = None
    description: Optional[str] = None


@strawberry.input
class DeleteDatasetSplitInput:
    prompt_label_id: GlobalID


@strawberry.input
class SetDatasetSplitInput:
    prompt_id: GlobalID
    prompt_label_id: GlobalID


@strawberry.input
class UnsetDatasetSplitInput:
    prompt_id: GlobalID
    prompt_label_id: GlobalID


@strawberry.type
class DatasetSplitMutationPayload:
    dataset_split: DatasetSplit
    query: "Query"


@strawberry.type
class DatasetSplitMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_dataset_split(
        self, info: Info[Context, None], input: CreateDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        pass

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def patch_dataset_split(
        self, info: Info[Context, None], input: PatchDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        pass

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_dataset_split(
        self, info: Info[Context, None], input: DeleteDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        pass

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def set_dataset_split(
        self, info: Info[Context, None], input: SetDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        pass

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def unset_dataset_split(
        self, info: Info[Context, None], input: UnsetDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        pass
