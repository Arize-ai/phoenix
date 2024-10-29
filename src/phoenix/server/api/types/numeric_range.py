import strawberry


@strawberry.type
class NumericRange:
    """A numeric range to denote a bin or domain"""

    start: float
    end: float
    # TODO consider denoting right open or closed
