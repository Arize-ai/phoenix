from __future__ import annotations

__all__ = ["HarborPluginError"]


class HarborPluginError(RuntimeError):
    """Raised when the Phoenix plugin cannot record a Harbor job."""
