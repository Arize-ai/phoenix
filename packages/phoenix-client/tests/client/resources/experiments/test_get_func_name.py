import functools

from phoenix.client.resources.experiments import get_func_name


def regular_function() -> str:
    """A regular function for testing."""
    return "test"


def function_with_args(x: int, y: str) -> str:
    """A function with arguments."""
    return f"{x}-{y}"


class DemoClass:
    """A demo class for testing method name extraction."""

    def method(self) -> str:
        """A class method."""
        return "method"

    @staticmethod
    def static_method() -> str:
        """A static method."""
        return "static"

    @classmethod
    def class_method(cls) -> str:
        """A class method."""
        return "class"


class MockCallableWithoutName:
    """A callable object without __name__ attribute."""

    def __call__(self) -> str:
        return "mock"


class TestGetFuncName:
    """Test suite for the get_func_name function."""

    def test_regular_function(self) -> None:
        """Test getting name of a regular function."""
        assert get_func_name(regular_function) == "regular_function"

    def test_function_with_args(self) -> None:
        """Test getting name of a function with arguments."""
        assert get_func_name(function_with_args) == "function_with_args"

    def test_lambda_function(self) -> None:
        """Test getting name of a lambda function."""
        lambda_func = lambda x: x * 2  # pyright: ignore[reportUnknownVariableType,reportUnknownLambdaType]
        # Lambda functions don't have a proper __qualname__ that doesn't end with <lambda>
        # so it should fall back to __name__ or str(func)
        result = get_func_name(lambda_func)  # pyright: ignore[reportUnknownArgumentType]
        assert result == "<lambda>"

    def test_partial_function(self) -> None:
        """Test getting name of a partial function."""
        partial_func = functools.partial(function_with_args, 42)
        assert get_func_name(partial_func) == "function_with_args"

    def test_nested_partial(self) -> None:
        """Test getting name of a partial of a partial."""
        partial_func = functools.partial(function_with_args, 42)
        nested_partial = functools.partial(partial_func, y="test")
        assert get_func_name(nested_partial) == "function_with_args"

    def test_local_function(self) -> None:
        """Test getting name of a local function."""

        def local_function() -> str:
            return "local"

        # Local functions have qualname like "test_local_function.<locals>.local_function"
        result = get_func_name(local_function)
        assert result == "local_function"

    def test_method(self) -> None:
        """Test getting name of a class method."""
        instance = DemoClass()
        assert get_func_name(instance.method) == "DemoClass.method"

    def test_static_method(self) -> None:
        """Test getting name of a static method."""
        assert get_func_name(DemoClass.static_method) == "DemoClass.static_method"

    def test_class_method(self) -> None:
        """Test getting name of a class method."""
        assert get_func_name(DemoClass.class_method) == "DemoClass.class_method"

    def test_callable_without_name(self) -> None:
        """Test getting name of a callable object without __name__."""
        mock_callable = MockCallableWithoutName()
        result = get_func_name(mock_callable)
        # Should fall back to str(func)
        assert "MockCallableWithoutName" in result

    def test_partial_of_method(self) -> None:
        """Test getting name of a partial function wrapping a method."""
        instance = DemoClass()
        partial_method = functools.partial(instance.method)
        assert get_func_name(partial_method) == "DemoClass.method"

    def test_deeply_nested_local_function(self) -> None:
        """Test getting name of a deeply nested local function."""

        def outer_function():  # type: ignore[no-untyped-def]
            def middle_function():  # type: ignore[no-untyped-def]
                def inner_function() -> str:
                    return "inner"

                return inner_function

            return middle_function()  # type: ignore[no-untyped-call]

        nested_func = outer_function()  # type: ignore[no-untyped-call]
        result = get_func_name(nested_func)
        assert result == "inner_function"

    def test_partial_of_lambda(self) -> None:
        """Test getting name of a partial function wrapping a lambda."""
        lambda_func = lambda x, y: x + y  # pyright: ignore[reportUnknownVariableType,reportUnknownLambdaType]
        partial_lambda = functools.partial(lambda_func, 10)  # pyright: ignore[reportUnknownVariableType]
        result = get_func_name(partial_lambda)  # pyright: ignore[reportUnknownArgumentType]
        assert result == "<lambda>"

    def test_builtin_function(self) -> None:
        """Test getting name of a builtin function."""
        assert get_func_name(len) == "len"
        assert get_func_name(str) == "str"

    def test_partial_of_builtin(self) -> None:
        """Test getting name of a partial function wrapping a builtin."""
        partial_builtin = functools.partial(max)
        assert get_func_name(partial_builtin) == "max"
