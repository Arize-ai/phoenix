from typing import Optional

import strawberry


@strawberry.type
class ValidationResult:
    is_valid: bool
    error_message: Optional[str]
    # Non-fatal advisories for a condition that compiles but may not behave as intended (e.g. a
    # dynamic name in a string-literal subscript that matches nothing). Additive and defaulted so
    # existing ``is_valid``/``error_message`` consumers are unaffected.
    warnings: list[str] = strawberry.field(default_factory=list)
