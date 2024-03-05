import strawberry

from .node import Node


@strawberry.type
class Project(Node):
    name: str
