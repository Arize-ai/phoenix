from typing import Optional

import strawberry


@strawberry.type
class ValidationResult:
    is_valid: bool
    error_message: Optional[str]
    error_start_offset: Optional[int] = None
    error_end_offset: Optional[int] = None
