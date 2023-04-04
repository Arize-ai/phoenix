import strawberry


@strawberry.type
class ExportedFile:
    file_name: str = strawberry.field(
        description="File name without the file extension.",
    )
