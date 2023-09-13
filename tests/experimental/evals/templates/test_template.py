import pytest
from phoenix.experimental.evals.templates.template import _deduce_binary_rails


def test_deduce_binary_rails() -> None:
    text = """response  has  to be, '1` or  `2", not '3' or '4'"""
    assert _deduce_binary_rails(text) == ("1", "2")
    del text

    text = """response  has  to be, '1` or"""
    with pytest.raises(ValueError):
        _deduce_binary_rails(text)
    del text
