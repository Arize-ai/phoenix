class PhoenixException(Exception):
    pass


class PhoenixContextLimitExceeded(PhoenixException):
    pass


class PhoenixEvaluationNameIsMissing(PhoenixException):
    pass
