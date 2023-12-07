from typing import Any


class _Missing:
    """
    Falsify all comparisons except those with self; return self when getattr()
    is called. Also, self is callable returning self. All this may seem peculiar
    but is useful for getting the desired (and intuitive) behavior from any
    boolean (i.e. comparative) expression without needing error handling when
    missing values are encountered. `_Missing()` is intended to be a (fancier)
    replacement for `None`.
    """

    def __lt__(self, _: Any) -> bool:
        return False

    def __le__(self, _: Any) -> bool:
        return False

    def __gt__(self, _: Any) -> bool:
        return False

    def __ge__(self, _: Any) -> bool:
        return False

    def __eq__(self, other: Any) -> bool:
        return isinstance(other, _Missing)

    def __ne__(self, _: Any) -> bool:
        return False

    def __len__(self) -> int:
        return 0

    def __iter__(self) -> Any:
        return self

    def __next__(self) -> Any:
        raise StopIteration()

    def __contains__(self, _: Any) -> bool:
        return False

    def __str__(self) -> str:
        return ""

    def __float__(self) -> float:
        return float("nan")

    def __bool__(self) -> bool:
        return False

    def __getattr__(self, _: Any) -> "_Missing":
        return self

    def __call__(self, *_: Any, **__: Any) -> "_Missing":
        return self


MISSING: Any = _Missing()
