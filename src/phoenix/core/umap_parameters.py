from dataclasses import dataclass
from typing import Union


@dataclass
class UMAPParameters:
    default_umap_params: Dict[str, Union[int, float]]
