class PhoenixException(Exception):
    pass


class PhoenixContextLimitExceeded(PhoenixException):
    pass


class PhoenixTemplateMappingError(PhoenixException):
    pass


class InvalidPromptTemplateError(PhoenixException):
    pass


class PhoenixUnsupportedAudioFormat(PhoenixException):
    pass


class PhoenixUnsupportedImageFormat(PhoenixException):
    pass
