from __future__ import annotations

__all__ = ["HarborPluginError"]


class HarborPluginError(RuntimeError):
    """Raised when the Phoenix plugin cannot record a Harbor job.

    Harbor lets ``on_job_start`` exceptions propagate, so raising this from job
    start aborts the job before any trial compute is spent. This is deliberate:
    selecting the Phoenix plugin makes successful Phoenix recording a
    requirement of the job.
    """
