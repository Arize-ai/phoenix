import pytest
from phoenix.utilities.error_handling import graceful_fallback


def test_graceful_fallback_forwards_call_to_fallback_function():
    def fallback(v) -> int:
        return v - 1

    @graceful_fallback(fallback_method=fallback)
    def check_the_answer(v) -> int:
        if v == 42:
            raise ValueError("42 is not the answer")
        return v

    assert check_the_answer(42) == 41


def test_graceful_fallback_logs_errors(caplog):
    @graceful_fallback(fallback_method=lambda *args, **kwargs: None)
    def failing_function(*args, **kwargs):
        raise ValueError("This is a test error.")

    failing_function("foo", bar="baz")  # graceful_fallback suppresses the error
    assert len(caplog.records) == 1, "graceful_fallback should log errors"
    assert "ValueError" in caplog.records[0].message, "Error type should be logged"
    assert "This is a test error." in caplog.records[0].message, "Error message should be logged"
    assert "failing_function" in caplog.records[0].message, "Failing function should be logged"
    assert "foo" in caplog.records[0].message, "Positional arguments should be logged"
    assert "'bar': 'baz'" in caplog.records[0].message, "Keyword arguments should be logged"
    assert (
        "Traceback (most recent call last):" in caplog.records[0].message
    ), "Traceback should be logged"


def test_graceful_fallback_only_suppresses_specified_errors():
    @graceful_fallback(fallback_method=lambda *args, **kwargs: None, exceptions=(ValueError,))
    def bad_division():
        return 1 / 0

    with pytest.raises(ZeroDivisionError):
        bad_division()  # graceful_fallback should not suppress ZeroDivisionError
