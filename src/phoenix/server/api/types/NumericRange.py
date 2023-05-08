import strawberry


@strawberry.type
class NumericRange:
    """A numeric range to denote a bin or domain"""

    min: float
    max: float
    # TODO consider denoting right open or closed
