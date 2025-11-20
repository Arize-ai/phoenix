from typing import Protocol


class CanGetString(Protocol):
    def get(self, key: str) -> str | None: ...
