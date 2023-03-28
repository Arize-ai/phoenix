import strawberry


@strawberry.type
class ExportedFile:
    file_name: str = strawberry.field(
        description="File name without the file extension.",
    )
    directory: str = strawberry.field(
        description="Disk location where the file is stored.",
    )
