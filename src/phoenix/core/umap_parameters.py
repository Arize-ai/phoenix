from dataclasses import dataclass
from typing import Union, Dict


@dataclass
class UMAPParameters:
    default_umap_params: Dict[str, Union[int, float]]
