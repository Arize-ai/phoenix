from datetime import datetime
from typing import Optional, cast

import pandas as pd
import pyarrow as pa


def table_to_bytes(table: pa.Table) -> bytes:
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return cast(bytes, sink.getvalue().to_pybytes())


def from_iso_format(value: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(value) if value else None


def df_to_bytes(df: pd.DataFrame) -> bytes:
    pa_table = pa.Table.from_pandas(df)
    return table_to_bytes(pa_table)
