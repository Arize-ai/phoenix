from typing import Optional

import strawberry

from phoenix.server.api.interceptor import GqlValueMediator


@strawberry.type
class DatasetValues:
    """Numeric values per dataset role"""

    primary_value: Optional[float] = strawberry.field(default=GqlValueMediator())
    reference_value: Optional[float] = strawberry.field(default=GqlValueMediator())

    def __iadd__(self, other: "DatasetValues") -> "DatasetValues":
        # TODO: right now NaN is ignored due to the logic of the GqlValueMediator
        # descriptor, i.e. adding NaN to a non-NaN existing value doesn't make
        # it NaN, or if the existing value is NaN, then adding a non-NaN value
        # to it will make it non-NaN.
        if self.primary_value is None:
            self.primary_value = other.primary_value
        elif other.primary_value is not None:
            self.primary_value += other.primary_value
        if self.reference_value is None:
            self.reference_value = other.reference_value
        elif other.reference_value is not None:
            self.reference_value += other.reference_value
        return self
