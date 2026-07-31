"""
What each provider accepts.

Separate from the builders because these are the part most likely to change as
providers add formats, and the per-provider tests pin them against the SDKs.
"""

OPENAI_SUPPORTED_IMAGE_MEDIA_TYPES = frozenset(
    ("image/png", "image/jpeg", "image/gif", "image/webp")
)

# Anthropic rejects HEIC/HEIF, which Google accepts.
ANTHROPIC_SUPPORTED_IMAGE_MEDIA_TYPES = frozenset(
    ("image/png", "image/jpeg", "image/gif", "image/webp")
)

OPENAI_SUPPORTED_FILE_MEDIA_TYPES = frozenset(("application/pdf",))
ANTHROPIC_SUPPORTED_FILE_MEDIA_TYPES = frozenset(("application/pdf",))
BEDROCK_DOCUMENT_FORMATS = {"application/pdf": "pdf"}
BEDROCK_SUPPORTED_FILE_MEDIA_TYPES = frozenset(BEDROCK_DOCUMENT_FORMATS)

# Bedrock Converse names formats rather than media types.
BEDROCK_IMAGE_FORMATS = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/gif": "gif",
    "image/webp": "webp",
}
BEDROCK_SUPPORTED_IMAGE_MEDIA_TYPES = frozenset(BEDROCK_IMAGE_FORMATS)


GOOGLE_SUPPORTED_IMAGE_MEDIA_TYPES = frozenset(
    (
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/heic",
        "image/heif",
    )
)
"""
Image types Gemini accepts as inline data.

Narrower than the set Phoenix will store: Gemini does not accept GIF.
"""

GOOGLE_SUPPORTED_MEDIA_TYPES = GOOGLE_SUPPORTED_IMAGE_MEDIA_TYPES | frozenset(("application/pdf",))
"""
Everything Gemini accepts as inline data, documents included.

A PDF travels the same `inline_data` channel as an image, which is why Google was
the cheapest provider to extend to documents.
"""
