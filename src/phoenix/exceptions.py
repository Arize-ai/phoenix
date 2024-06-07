class PhoenixException(Exception):
    pass


class PhoenixEvaluationNameIsMissing(PhoenixException):
    pass


class PhoenixMigrationError(PhoenixException):
    pass
