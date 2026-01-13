# Phoenix Evals Design Guidelines

## Code Style

- Use clear, descriptive function names
- Provide comprehensive docstrings for all public APIs
- Follow numpy docstring format
- Include type hints

## Docstring Format

```python
def function_name(param1: Type1, param2: Type2) -> ReturnType:
    """
    Brief description.

    Detailed description if needed.

    Parameters
    ----------
    param1 : Type1
        Description of param1
    param2 : Type2
        Description of param2

    Returns
    -------
    ReturnType
        Description of return value

    Examples
    --------
    >>> example_code()
    """
```

## Workflow

1. Design evaluator interfaces clearly
2. Add comprehensive docstrings
3. Include usage examples
4. Test with various LLM providers
