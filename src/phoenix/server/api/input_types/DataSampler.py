from dataclasses import field

import strawberry


@strawberry.input
class DataSampler:
    seed: int = field(default=1234567890)
    n_samples: int = field(default=1000)
