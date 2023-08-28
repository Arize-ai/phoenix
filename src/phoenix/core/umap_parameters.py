from dataclasses import dataclass
from typing import Union


@dataclass
class UMAPParameters:
    default_umap_params: dict[str, Union[int, float]]
