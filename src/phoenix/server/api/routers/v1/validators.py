from fastapi import HTTPException


def validate_enum_filter(
    *,
    values: list[str],
    valid: frozenset[str],
    param_name: str,
) -> list[str]:
    """Validate and uppercase a list of enum filter values, raising 422 for invalid ones."""
    upper = [v.upper() for v in values]
    invalid = [v for v in upper if v not in valid]
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {param_name} values: {invalid}",
        )
    return upper
