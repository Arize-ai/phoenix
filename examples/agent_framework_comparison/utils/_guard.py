"""
Patch ``openai.resources.chat.completions.Completions.create`` to raise a
descriptive ``RuntimeError`` when the API returns an empty choices list,
instead of letting ``choices[0]`` raise a bare ``IndexError``.

Import for side effects — no call-site changes required::

    from utils import _guard  # noqa: F401

Empty-choices responses occur when:
  - the provider's content-policy filter blocks the reply
  - a streaming response is truncated before the first choice arrives
  - a non-standard OpenAI-compatible provider returns an unexpected body
"""

import functools

try:
    from openai.resources.chat.completions import Completions as _Completions

    _orig_create = _Completions.create

    @functools.wraps(_orig_create)
    def _safe_create(self, *args, **kwargs):  # type: ignore[override]
        response = _orig_create(self, *args, **kwargs)
        if not response.choices:
            raise RuntimeError(
                "LLM returned an empty choices list. "
                "Possible causes: content-policy filtering, stream truncation, "
                "or a provider that returns a non-standard response body. "
                f"Full response: {response!r}"
            )
        return response

    _Completions.create = _safe_create  # type: ignore[method-assign]

except ImportError:
    pass  # openai not installed; guard is a no-op
