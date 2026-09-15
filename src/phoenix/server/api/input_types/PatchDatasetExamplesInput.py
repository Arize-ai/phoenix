from enum import Enum
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.enum(description="A field of a dataset example that a `replace` operation can target.")
class DatasetExampleField(Enum):
    INPUT = "input"
    OUTPUT = "output"
    METADATA = "metadata"


@strawberry.input(
    description=(
        "The full value of a dataset example. `input`, `output`, and `metadata` must be "
        "JSON objects. `externalId` is an optional custom ID; leave it out to have one "
        "generated."
    )
)
class DatasetExampleValueInput:
    input: JSON
    output: JSON
    metadata: JSON
    external_id: Optional[str] = UNSET


@strawberry.input(
    description=(
        "Adds an example with the given value. Added examples are not linked to a span; "
        "use `addExamplesToDataset` for span-sourced examples."
    )
)
class AddDatasetExampleOperation:
    value: DatasetExampleValueInput


@strawberry.input(
    description=(
        "Replaces one field of an existing example with `value`, a JSON object. Fields "
        "the operation list never names carry over from the example's latest revision."
    )
)
class ReplaceDatasetExampleFieldOperation:
    example_id: GlobalID
    field: DatasetExampleField
    value: JSON


@strawberry.input(description="Removes an existing example from the dataset.")
class RemoveDatasetExampleOperation:
    example_id: GlobalID


@strawberry.input(
    one_of=True,
    description=(
        "One change to a dataset's examples, after JSON Patch (RFC 6902). Exactly one of "
        "`add`, `replace`, or `remove` is set."
    ),
)
class DatasetExampleOperation:
    add: Optional[AddDatasetExampleOperation] = UNSET
    replace: Optional[ReplaceDatasetExampleFieldOperation] = UNSET
    remove: Optional[RemoveDatasetExampleOperation] = UNSET


@strawberry.input(
    description=(
        "Input to the `patchDatasetExamples` mutation. The operations are applied in "
        "order and committed together as one new dataset version, or not at all. Later "
        "operations see the effect of earlier ones: replacing a field twice keeps the "
        "last value, removing an example discards its replacements, and targeting an "
        "example after it was removed is an error."
    )
)
class PatchDatasetExamplesInput:
    dataset_id: GlobalID
    operations: list[DatasetExampleOperation]
    version_description: Optional[str] = UNSET
    version_metadata: Optional[JSON] = UNSET
