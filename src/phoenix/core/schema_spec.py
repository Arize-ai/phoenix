from abc import ABC
from dataclasses import dataclass, fields
from typing import get_args

from phoenix.core.helpers import coerce_to_string


@dataclass(frozen=True)
class SchemaSpec(ABC):
    """Superclass for the Schema itself and any of its components, all of
    which share the trait that they use column names to define the model
    structure (or substructures)."""

    def __post_init__(self) -> None:
        """Ensure column names are string at run time, which may not be true
        if the user takes them directly from `pd.dataframe.columns`, which
        can contain numbers. Phoenix always uses string to refer to columns
        and dimensions, so this step is intended to eliminate any potential
        issues caused by any pd.DataFrame having numbers as column names.
        """
        for f in fields(self):
            if f.type is str or set(get_args(f.type)) == {str, type(None)}:
                # Ensure string if type is `str` or `Optional[str]` (the
                # latter being `Union[str, None]` under the hood). Use
                # `__setattr__` because `self` is read-only, i.e. frozen.
                object.__setattr__(self, f.name, coerce_to_string(getattr(self, f.name)))
