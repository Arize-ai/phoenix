from typing import Any

from pydantic import BaseModel, ConfigDict


class DBBaseModel(BaseModel):
    """
    A base Pydantic model suitable for use with JSON columns in the database.
    """

    model_config = ConfigDict(
        extra="forbid",  # disallow extra attributes
        use_enum_values=True,
        validate_assignment=True,
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs = {k: v for k, v in kwargs.items() if v is not UNDEFINED}
        super().__init__(*args, **kwargs)

    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        return super().model_dump(*args, exclude_unset=True, by_alias=True, **kwargs)


class Undefined:
    """
    A singleton class that represents an unset or undefined value. Needed since Pydantic
    can't natively distinguish between an undefined value and a value that is set to
    None.
    """

    def __new__(cls) -> Any:
        if not hasattr(cls, "_instance"):
            cls._instance = super().__new__(cls)
        return cls._instance

    def __bool__(self) -> bool:
        return False


UNDEFINED: Any = Undefined()
