from typing import Optional

import strawberry


@strawberry.type
class ValidationResult:
    is_valid: bool
    error_message: Optional[str]
    warnings: list[str] = strawberry.field(default_factory=list)
