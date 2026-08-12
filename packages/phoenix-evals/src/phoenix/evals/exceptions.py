from phoenix.executors.exceptions import PhoenixException

__all__ = [
    "PhoenixContextLimitExceeded",
    "PhoenixException",
    "PhoenixTemplateMappingError",
    "PhoenixUnsupportedAudioFormat",
    "PhoenixUnsupportedImageFormat",
]


class PhoenixContextLimitExceeded(PhoenixException):
    pass


class PhoenixTemplateMappingError(PhoenixException):
    pass


class PhoenixUnsupportedAudioFormat(PhoenixException):
    pass


class PhoenixUnsupportedImageFormat(PhoenixException):
    pass
