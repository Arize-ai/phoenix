from enum import Enum
from typing import Dict, Union

import strawberry

from phoenix.core.model_schema import PRIMARY, REFERENCE


@strawberry.enum
class InferencesRole(Enum):
    primary = PRIMARY
    reference = REFERENCE


class AncillaryInferencesRole(Enum):
    corpus = "InferencesRole.CORPUS"


STR_TO_INFEREENCES_ROLE: Dict[str, Union[InferencesRole, AncillaryInferencesRole]] = {
    str(InferencesRole.primary.value): InferencesRole.primary,
    str(InferencesRole.reference.value): InferencesRole.reference,
    str(AncillaryInferencesRole.corpus.value): AncillaryInferencesRole.corpus,
}
