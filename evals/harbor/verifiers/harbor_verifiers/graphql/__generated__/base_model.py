from pydantic import BaseModel as PydanticBaseModel
from pydantic import ConfigDict


class UnsetType:
    def __bool__(self) -> bool:
        return False


UNSET = UnsetType()


class BaseModel(PydanticBaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        validate_assignment=True,
        arbitrary_types_allowed=True,
        protected_namespaces=(),
    )
