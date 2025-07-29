import strawberry


@strawberry.type
class ServerStatus:
    insufficient_storage: bool
