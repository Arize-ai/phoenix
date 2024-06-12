from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List


@dataclass(frozen=True)
class Example:
    id: str
    input: Dict[str, Any]
    output: Dict[str, Any]
    metadata: Dict[str, Any]
    updated_at: datetime


@dataclass(frozen=True)
class Dataset:
    id: str
    version_id: str
    examples: List[Example]
