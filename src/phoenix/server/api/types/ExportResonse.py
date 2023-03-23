import strawberry


@strawberry.type()
class ExportResponse:
    filename: str
    directory: str
