from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List


@dataclass(frozen=True)
class Example:
    """
    Contains input, output, metadata, and other information for a dataset
    example.
    """

    id: str
    input: Dict[str, Any]
    output: Dict[str, Any]
    metadata: Dict[str, Any]
    updated_at: datetime


@dataclass(frozen=True)
class Dataset:
    """
    Contains dataset metadata and examples.
    """

    id: str
    version_id: str
    examples: List[Example]
