class PhoenixException(Exception):
    pass


class PhoenixContextLimitExceeded(PhoenixException):
    pass


class PhoenixTemplateMappingError(PhoenixException):
    pass


class PhoenixInvalidPromptTemplateError(PhoenixException):
    """Raised when a prompt template fails evaluator-specific validation
    (e.g., pairwise templates that reference reserved variables or omit the
    required A/B markers)."""

    pass


class PhoenixUnsupportedAudioFormat(PhoenixException):
    pass


class PhoenixUnsupportedImageFormat(PhoenixException):
    pass
