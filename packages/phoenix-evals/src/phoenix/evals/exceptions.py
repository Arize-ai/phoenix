class PhoenixException(Exception):
    pass


class PhoenixContextLimitExceeded(PhoenixException):
    pass


class PhoenixTemplateMappingError(PhoenixException):
    pass


class PhoenixUnsupportedAudioFormat(PhoenixException):
    pass


class PhoenixUnsupportedImageFormat(PhoenixException):
    pass


class PhoenixDecisionRefusal(PhoenixException):
    """Raised when a decision model refuses to answer a classification question."""

    pass
