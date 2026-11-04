"""
The token types that instrumentors report in span token-count details and that
cost tracking prices. Instrumentors emit them in lowercase, and cost lookup
matches them exactly.

The frontend mirrors these in js/app/src/pages/settings/ModelTokenTypeComboBox.tsx
and js/app/src/utils/tokenDetailUtils.ts.
"""

from typing import Final

INPUT_TOKEN_TYPE: Final = "input"
"""Required prompt token type, and the fallback for unpriced prompt token types."""
OUTPUT_TOKEN_TYPE: Final = "output"
"""Required completion token type, and the fallback for unpriced completion token types."""
AUDIO_TOKEN_TYPE: Final = "audio"
CACHE_READ_TOKEN_TYPE: Final = "cache_read"
CACHE_WRITE_TOKEN_TYPE: Final = "cache_write"
REASONING_TOKEN_TYPE: Final = "reasoning"

KNOWN_TOKEN_TYPES: Final[frozenset[str]] = frozenset(
    {
        INPUT_TOKEN_TYPE,
        OUTPUT_TOKEN_TYPE,
        AUDIO_TOKEN_TYPE,
        CACHE_READ_TOKEN_TYPE,
        CACHE_WRITE_TOKEN_TYPE,
        REASONING_TOKEN_TYPE,
    }
)
