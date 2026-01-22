import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


@dataclass
class CancellationReason:
    """Reason for cancellation with metadata."""

    reason: str
    cancelled_at: datetime
    cancelled_by: Optional[str] = None


class PlaygroundCancellationToken:
    """
    Thread-safe, efficient cancellation token for playground operations.
    Uses asyncio.Event for O(1) cancellation checking.
    """

    def __init__(self, operation_id: str):
        self.operation_id = operation_id
        self._cancelled = asyncio.Event()
        self._reason: Optional[CancellationReason] = None

    def cancel(
        self, reason: str = "User requested cancellation", cancelled_by: Optional[str] = None
    ) -> None:
        """Mark this operation as cancelled."""
        if not self._cancelled.is_set():
            self._reason = CancellationReason(
                reason=reason,
                cancelled_at=datetime.now(timezone.utc),
                cancelled_by=cancelled_by,
            )
            self._cancelled.set()

    def is_cancelled(self) -> bool:
        """Check if cancellation was requested. O(1) operation."""
        return self._cancelled.is_set()

    async def check_cancelled(self) -> None:
        """Raise CancellationRequested if cancelled."""
        if self.is_cancelled():
            raise CancellationRequested(self._reason.reason if self._reason else "Cancelled")

    @property
    def reason(self) -> Optional[CancellationReason]:
        """Get cancellation reason if cancelled."""
        return self._reason


class CancellationRequested(Exception):
    """Exception raised when operation is cancelled."""

    pass
