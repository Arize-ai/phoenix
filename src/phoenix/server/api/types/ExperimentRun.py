from datetime import datetime
from typing import Any, Dict, Optional

import strawberry
from strawberry.relay import GlobalID


@strawberry.type
class ExperimentRun:
    trace_id: GlobalID
    output: Optional[Dict[str, Any]]
    start_time: datetime
    end_time: datetime
    error: Optional[str]
