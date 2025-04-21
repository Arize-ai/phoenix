from typing import Annotated

from pydantic import Field, RootModel


class Identifier(RootModel[str]):
    root: Annotated[str, Field(pattern=r"^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$")]

    def __hash__(self) -> int:
        return hash(self.root)
