from __future__ import annotations

from typing import Literal

__all__ = [
    "NOT_GIVEN",
    "NotGiven",
]


class NotGiven:
    """Sentinel type for an argument the caller did not supply.

    Partial-update methods need to distinguish three states for a nullable
    field: left alone, set to a value, and cleared. ``None`` means "clear", so
    omission needs its own marker. Use the :data:`NOT_GIVEN` singleton rather
    than instantiating this class. Test for it with ``x is NOT_GIVEN``, or with
    ``isinstance(x, NotGiven)`` where a type checker needs to narrow the union.

    Example::

        from phoenix.client import Client
        from phoenix.client.types import NOT_GIVEN, NotGiven

        def rename(description: str | None | NotGiven = NOT_GIVEN) -> None:
            Client().prompts.update(
                prompt_identifier="my-prompt",
                prompt_description=description,
            )
    """

    __slots__ = ()

    def __bool__(self) -> Literal[False]:
        return False

    def __repr__(self) -> str:
        return "NOT_GIVEN"


NOT_GIVEN = NotGiven()
