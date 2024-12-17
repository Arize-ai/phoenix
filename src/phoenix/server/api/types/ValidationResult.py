from typing import Optional

import strawberry


@strawberry.type
class ValidationResult:
    is_valid: bool
    error_message: Optional[str]
