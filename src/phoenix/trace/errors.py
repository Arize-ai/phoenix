from phoenix.exceptions import PhoenixException


class InvalidParquetMetadataError(PhoenixException):
    pass


class IncompatibleLibraryVersionError(PhoenixException):
    pass
