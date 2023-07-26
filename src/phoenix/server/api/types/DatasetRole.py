from enum import Enum
from typing import Dict, Union

import strawberry

from phoenix.core.model_schema import PRIMARY, REFERENCE


@strawberry.enum
class DatasetRole(Enum):
    primary = PRIMARY
    reference = REFERENCE


class AncillaryDatasetRole(Enum):
    corpus = "DatasetRole.CORPUS"


STR_TO_DATASET_ROLE: Dict[str, Union[DatasetRole, AncillaryDatasetRole]] = {
    str(DatasetRole.primary.value): DatasetRole.primary,
    str(DatasetRole.reference.value): DatasetRole.reference,
    str(AncillaryDatasetRole.corpus.value): AncillaryDatasetRole.corpus,
}
